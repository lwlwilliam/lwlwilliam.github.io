package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type APIService struct {
	site    *Site
	buildMu sync.Mutex
}

func (a *APIService) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/posts", a.handlePosts)
	mux.HandleFunc("GET /api/file", a.handleGetFile)
	mux.HandleFunc("POST /api/save", a.handleSave)
	mux.HandleFunc("POST /api/new", a.handleNew)
	mux.HandleFunc("POST /api/article/rename", a.handleArticleRename)
	mux.HandleFunc("POST /api/article/delete", a.handleArticleDelete)
	mux.HandleFunc("POST /api/render", a.handleRender)
	mux.HandleFunc("POST /api/upload", a.handleUpload)
	mux.HandleFunc("POST /api/build", a.handleBuild)
	mux.HandleFunc("POST /api/asset-info", a.handleAssetInfo)
	mux.HandleFunc("POST /api/assets/delete", a.handleAssetsDelete)
	mux.HandleFunc("GET /api/chroma.css", a.handleChromaCSS)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (a *APIService) handlePosts(w http.ResponseWriter, r *http.Request) {
	posts, pages, err := a.site.List()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"posts": posts, "pages": pages})
}

func (a *APIService) handleGetFile(w http.ResponseWriter, r *http.Request) {
	rel := r.URL.Query().Get("path")
	if rel == "" {
		writeErr(w, http.StatusBadRequest, "缺少 path 参数")
		return
	}
	content, err := a.site.ReadFile(rel)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": rel, "content": content})
}

func (a *APIService) handleSave(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.site.SaveFile(body.Path, body.Content); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true", "path": body.Path})
}

func (a *APIService) handleNew(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title    string `json:"title"`
		Category string `json:"category"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	rel, err := a.site.NewPost(body.Title, body.Category)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": rel})
}

func (a *APIService) handleArticleRename(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	newPath, err := a.site.RenamePost(body.Path, body.Name)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true", "path": newPath})
}

func (a *APIService) handleArticleDelete(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.site.DeletePost(body.Path); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true", "path": body.Path})
}

func (a *APIService) handleRender(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	html, err := RenderPreview(a.site, body.Path, body.Content)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"html": html})
}

func (a *APIService) handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, "上传数据解析失败: "+err.Error())
		return
	}
	kind := r.FormValue("kind")
	post := r.FormValue("path")
	file, header, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	if kind != "image" && kind != "file" {
		writeErr(w, http.StatusBadRequest, "无效的 kind")
		return
	}
	insert, err := a.site.Upload(kind, header.Filename, file, post)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"insert": insert})
}

func (a *APIService) handleChromaCSS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(ChromaCSS()))
}

func (a *APIService) handleBuild(w http.ResponseWriter, r *http.Request) {
	// 防止并行触发两次构建
	if !a.buildMu.TryLock() {
		writeErr(w, http.StatusConflict, "已有构建正在进行")
		return
	}
	defer a.buildMu.Unlock()

	hugoPath, err := findHugo()
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	start := time.Now()
	// --cleanDestinationDir 清理陈旧产物，--minify 压缩生成的 HTML。
	cmd := exec.Command(hugoPath, "--cleanDestinationDir", "--minify", "--quiet")
	cmd.Dir = a.site.Root
	out, err := cmd.CombinedOutput()
	secs := time.Since(start).Seconds()

	resp := map[string]any{
		"ok":      err == nil,
		"seconds": fmt.Sprintf("%.1f", secs),
		"output":  strings.TrimSpace(string(out)),
	}
	if err != nil {
		resp["error"] = fmt.Sprintf("hugo 退出异常 (%v)", err)
	}
	writeJSON(w, http.StatusOK, resp)
}

func findHugo() (string, error) {
	if p, err := exec.LookPath("hugo"); err == nil {
		return p, nil
	}
	var candidates []string
	switch runtime.GOOS {
	case "darwin":
		candidates = []string{"/opt/homebrew/bin/hugo", "/usr/local/bin/hugo"}
	case "windows":
		candidates = []string{`C:\Program Files\hugo\hugo.exe`}
	default:
		candidates = []string{"/usr/local/bin/hugo", "/usr/bin/hugo", "/snap/bin/hugo"}
	}
	home, _ := os.UserHomeDir()
	candidates = append(candidates, filepath.Join(home, "go", "bin", "hugo"))
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c, nil
		}
	}
	return "", fmt.Errorf("未找到 hugo 可执行文件（PATH 与常见路径均无），请确认 hugo 已安装")
}

func (a *APIService) handleAssetInfo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	info, err := a.site.GetAssetInfo(body.Path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (a *APIService) handleAssetsDelete(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := decodeBody(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(body.Paths) == 0 {
		writeErr(w, http.StatusBadRequest, "未指定要删除的文件")
		return
	}
	deleted := []string{}
	failed := []map[string]string{}
	for _, p := range body.Paths {
		if err := a.site.DeleteAsset(p); err != nil {
			failed = append(failed, map[string]string{"path": p, "error": err.Error()})
			continue
		}
		deleted = append(deleted, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": deleted, "failed": failed})
}

func decodeBody(r *http.Request, v any) error {
	b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("无效的请求数据")
	}
	return nil
}
