package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func main() {
	var (
		port = flag.Int("port", 8377, "监听端口（默认 8377）")
		open = flag.Bool("open", true, "启动后自动打开浏览器")
		root = flag.String("root", "", "Hugo 根目录（默认向上查找 hugo 配置文件）")
	)
	flag.Parse()

	wd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	siteRoot := *root
	if siteRoot == "" {
		siteRoot = detectRoot(wd)
	}
	siteRoot, _ = filepath.Abs(siteRoot)

	site := NewSite(siteRoot)
	if !dirExists(site.ContentRoot()) {
		fmt.Fprintf(os.Stderr, "未找到 content 目录（请确认在 hugo 站点根目录运行，或使用 -root 指定），查找路径: %s\n", site.ContentRoot())
		os.Exit(1)
	}

	srv := &http.Server{Handler: newServer(site)}

	var listener net.Listener
	url := ""
	for p := *port; p < *port+50; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err != nil {
			continue
		}
		listener = ln
		url = fmt.Sprintf("http://127.0.0.1:%d", p)
		break
	}
	if listener == nil {
		log.Fatalf("无法监听端口 %d 及之后的端口", *port)
	}

	log.Printf("站点根目录: %s (content=%s static=%s)", siteRoot, site.ContentDir, site.StaticDir)
	log.Printf("编辑器已就绪: %s  (Ctrl+C 退出)", url)
	if *open {
		go openBrowser(url)
	}
	if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", url).Start()
	case "windows":
		_ = exec.Command("cmd", "/c", "start", "", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
}
