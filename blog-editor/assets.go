package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// AssetInfo reports whether a static/assets file exists (relative to static root)
// and which markdown files / layout templates reference it.
type AssetInfo struct {
	Exists bool     `json:"exists"`
	Path   string   `json:"path"`
	Size   int64    `json:"size"`
	Refs   []string `json:"refs"`  // markdown sources under content/
	TRefs  []string `json:"trefs"` // layout templates under layouts/
}

// readTextFiles collects text files under base with display labels "dir/rel".
func readTextFiles(base string, into map[string]string, mbLimit int64) {
	if mbLimit <= 0 {
		mbLimit = 1
	}
	_ = filepath.WalkDir(base, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		st, serr := d.Info()
		if serr != nil || st.Size() > mbLimit*1024*1024 {
			return nil
		}
		rel, rerr := filepath.Rel(base, path)
		if rerr != nil {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		into[filepath.ToSlash(base)+"/"+filepath.ToSlash(rel)] = string(b)
		return nil
	})
}

// GetAssetInfo looks one asset up: existence plus文章/模板 references.
func (s *Site) GetAssetInfo(assetRel string) (*AssetInfo, error) {
	assetRel = strings.TrimPrefix(filepath.ToSlash(assetRel), "assets/")
	if assetRel == "" || strings.Contains(assetRel, "..") || strings.HasPrefix(assetRel, "/") {
		return nil, errors.New("无效的资源路径")
	}
	info := &AssetInfo{
		Exists: false,
		Path:   "assets/" + assetRel,
		Refs:   []string{},
		TRefs:  []string{},
	}
	abs, err := safeJoin(s.StaticRoot(), info.Path)
	if err != nil {
		return nil, err
	}
	st, err := os.Stat(abs)
	if err != nil || st.IsDir() {
		return info, nil
	}
	info.Exists = true
	info.Size = st.Size()

	marker := "assets/" + assetRel

	sources := map[string]string{}
	readTextFiles(s.ContentRoot(), sources, 2)
	for path, content := range sources {
		if strings.Contains(content, marker) {
			info.Refs = append(info.Refs, pathToLabel(s.ContentRoot(), path))
		}
	}

	templates := map[string]string{}
	readTextFiles(filepath.Join(s.Root, "layouts"), templates, 1)
	for path, content := range templates {
		if strings.Contains(content, marker) {
			info.TRefs = append(info.TRefs, pathToLabel(filepath.Join(s.Root, "layouts"), path))
		}
	}
	sort.Strings(info.Refs)
	sort.Strings(info.TRefs)
	return info, nil
}

func pathToLabel(base, path string) string {
	rel, err := filepath.Rel(base, path)
	if err != nil {
		return path
	}
	return filepath.ToSlash(rel)
}

// DeleteAsset removes one file under static/assets and prunes now-empty date dirs.
func (s *Site) DeleteAsset(assetRel string) error {
	assetRel = strings.TrimPrefix(filepath.ToSlash(assetRel), "assets/")
	if assetRel == "" || strings.Contains(assetRel, "..") || strings.HasPrefix(assetRel, "/") {
		return errors.New("仅允许删除 static/assets 下的文件")
	}
	info := "assets/" + assetRel
	abs, err := safeJoin(s.StaticRoot(), info)
	if err != nil {
		return err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return fmt.Errorf("文件不存在: %s", info)
	}
	if st.IsDir() {
		return errors.New("不支持删除目录")
	}
	if err := os.Remove(abs); err != nil {
		return err
	}

	// prune empty dirs like assets/images/2026/1106 upwards (never prune roots)
	assetsAbs := filepath.Join(s.StaticRoot(), "assets")
	imagesAbs := filepath.Join(assetsAbs, "images")
	filesAbs := filepath.Join(assetsAbs, "files")
	dir := filepath.Dir(abs)
	for dir != assetsAbs && dir != imagesAbs && dir != filesAbs && strings.HasPrefix(dir, assetsAbs) {
		items, rerr := os.ReadDir(dir)
		if rerr != nil || len(items) > 0 {
			break
		}
		if rmErr := os.Remove(dir); rmErr != nil {
			break
		}
		dir = filepath.Dir(dir)
	}
	return nil
}
