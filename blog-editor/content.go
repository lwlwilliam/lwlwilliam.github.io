package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
)

// Site represents the hugo site root.
type Site struct {
	Root       string
	ContentDir string
	StaticDir  string
}

func (s *Site) ContentRoot() string { return filepath.Join(s.Root, s.ContentDir) }

func (s *Site) StaticRoot() string { return filepath.Join(s.Root, s.StaticDir) }

// NewSite detects the hugo site layout under root.
func NewSite(root string) *Site {
	staticDir := "static"
	contentDir := "content"
	for _, name := range []string{"hugo.toml", "config.toml", "hugo.yaml", "hugo.yml", "config.yaml", "config.yml"} {
		b, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		contentDir = pickConfigValue(string(b), "contentDir", contentDir)
		staticDir = pickConfigValue(string(b), "staticDir", staticDir)
		break
	}
	return &Site{Root: root, ContentDir: contentDir, StaticDir: staticDir}
}

// pickConfigValue does a tiny key=value lookup in hugo.toml / hugo.yaml.
func pickConfigValue(content, key, fallback string) string {
	re := regexp.MustCompile(`(?im)^[[:space:]]*(?:` + key + `)[[:space:]]*[:=][[:space:]]*['"]?([A-Za-z0-9_\-./]+)`)
	m := re.FindStringSubmatch(content)
	if m == nil {
		return fallback
	}
	return m[1]
}

func detectRoot(start string) string {
	dir := start
	for i := 0; i < 6; i++ {
		for _, name := range []string{"hugo.toml", "hugo.yaml", "hugo.yml", "config.toml", "config.yaml", "config.yml"} {
			if fileExists(filepath.Join(dir, name)) {
				return dir
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	// Fall back to the current dir; flags can still be adjusted.
	return start
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

// PostMeta is one markdown file shown in the sidebar.
type PostMeta struct {
	Path  string `json:"path"` // slash path relative to content root
	Group string `json:"group"`
	Year  string `json:"year"`
	Title string `json:"title"`
	Date  string `json:"date"`
	Draft bool   `json:"draft"`
}

var mdExts = map[string]bool{".md": true, ".markdown": true, ".mdown": true}

// List walks the content dir. posts/xxx is grouped by year subdirectory.
func (s *Site) List() ([]*PostMeta, []*PostMeta, error) {
	root := s.ContentRoot()
	posts := []*PostMeta{}
	pages := []*PostMeta{}

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := d.Name()
		if d.IsDir() {
			if strings.HasPrefix(name, ".") && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(name, ".") || !mdExts[strings.ToLower(filepath.Ext(name))] {
			return nil
		}
		rel, rerr := filepath.Rel(root, path)
		if rerr != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)

		data, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		fm, body := SplitFrontMatter(string(data))
		meta := ParseMeta(fm)
		title := meta["title"]
		if title == "" {
			title = TitleFromBody(body, name, rel)
		}
		date := meta["date"]
		draft := Truthy(meta["draft"])

		p := &PostMeta{Path: rel, Title: title, Date: date, Draft: draft}
		parts := strings.SplitN(rel, "/", 3)
		yearRe := regexp.MustCompile(`^\d{4}$`)
		switch {
		case len(parts) >= 2 && parts[0] == "posts" && yearRe.MatchString(parts[1]):
			p.Group, p.Year = "post", parts[1]
		case extractYear(date) != "":
			p.Group, p.Year = "post", extractYear(date)
		default:
			p.Group = "page"
		}
		if p.Group == "post" {
			posts = append(posts, p)
		} else {
			pages = append(pages, p)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	sort.Slice(posts, func(i, j int) bool { return postLess(posts[i], posts[j], dateRe) })
	sort.Slice(pages, func(i, j int) bool { return postLess(pages[i], pages[j], dateRe) })
	return posts, pages, nil
}

var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-`)

func postLess(a, b *PostMeta, nameDateRe *regexp.Regexp) bool {
	ay, by := a.Year, b.Year
	if ay == "" {
		ay = "0000"
	}
	if by == "" {
		by = "0000"
	}
	if ay != by {
		return ay > by
	}
	ad, bd := a.Date, b.Date
	if ad == "" {
		ad = dateFromName(a.Path, nameDateRe)
	}
	if bd == "" {
		bd = dateFromName(b.Path, nameDateRe)
	}
	if ad != bd {
		return ad > bd
	}
	return a.Title < b.Title
}

func dateFromName(path string, nameDateRe *regexp.Regexp) string {
	base := filepath.Base(path)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if nameDateRe.MatchString(base) {
		return base[:10]
	}
	return ""
}

func extractYear(date string) string {
	if len(date) >= 4 && isAllDigits(date[:4]) {
		return date[:4]
	}
	return ""
}

func isAllDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}

// safeJoin resolves rel under root, refusing any escape.
func safeJoin(root, rel string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	abs, err := filepath.Abs(filepath.Join(absRoot, rel))
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if abs != absRoot && !strings.HasPrefix(abs, absRoot+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes %s", absRoot)
	}
	return abs, nil
}

// ReadFile returns file content by content-root-relative path.
func (s *Site) ReadFile(rel string) (string, error) {
	abs, err := safeJoin(s.ContentRoot(), rel)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(abs)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// SaveFile writes markdown under the content root.
func (s *Site) SaveFile(rel, content string) error {
	abs, err := safeJoin(s.ContentRoot(), rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o775); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

// NewPost creates a post like new_post.py does: content/posts/<year>/<date>-<slug>.md
func (s *Site) NewPost(title, category string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", errors.New("标题不能为空")
	}
	now := time.Now()
	date := now.Format("2006-01-02")
	year := now.Format("2006")

	dir := filepath.Join(s.ContentRoot(), "posts", year)
	if err := os.MkdirAll(dir, 0o775); err != nil {
		return "", err
	}

	// dedupe with -1, -2 suffixes
	fname := date + "-" + slugify(title) + ".md"
	target := filepath.Join(dir, fname)
	for i := 1; fileExists(target); i++ {
		target = filepath.Join(dir, fmt.Sprintf("%s-%s-%d.md", date, slugify(title), i))
	}

	cats := ""
	if category != "" {
		cats = strings.TrimSpace(category)
	}
	content := fmt.Sprintf("---\ndate: %s\ntitle: %s\ncategories: [%s]\nkeywords: [%s]\n---\n\n",
		date, title, cats, cats)

	if err := os.WriteFile(target, []byte(content), 0o644); err != nil {
		return "", err
	}
	rel, err := filepath.Rel(s.ContentRoot(), target)
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(rel), nil
}

// slugify keeps CJK letters, digits and -. otherwise turns to '-'.
func slugify(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			if r < 128 {
				b.WriteRune(unicode.ToLower(r))
			} else {
				b.WriteRune(r)
			}
		case r == ' ' || r == '_':
			b.WriteRune('-')
		case r == '-' || r == '.':
			b.WriteRune(r)
		}
	}
	out := b.String()
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	out = strings.Trim(out, "-.")
	if out == "" {
		out = "post"
	}
	return out
}

var imageExtRe = regexp.MustCompile(`(?i)^\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$`)

// Upload stores an uploaded asset under static/ and returns the
// markdown snippet (with a path relative to the current post file).
func (s *Site) Upload(kind, fileName string, r io.Reader, postRel string) (string, error) {
	name := sanitizeName(fileName)
	if name == "" {
		return "", errors.New("无效的文件名")
	}
	ext := strings.ToLower(filepath.Ext(name))
	stem := strings.TrimSuffix(name, filepath.Ext(name))

	var dir string
	if kind == "image" {
		if !imageExtRe.MatchString(ext) {
			return "", fmt.Errorf("不支持的图片格式: %s", ext)
		}
		now := time.Now()
		dir = filepath.Join(s.StaticRoot(), "assets", "images", now.Format("2006"), now.Format("0102"))
	} else {
		dir = filepath.Join(s.StaticRoot(), "assets", "files")
	}
	if err := os.MkdirAll(dir, 0o775); err != nil {
		return "", err
	}

	target := name
	for i := 1; fileExists(filepath.Join(dir, target)); i++ {
		target = fmt.Sprintf("%s-%d%s", stem, i, ext)
	}

	abs := filepath.Join(dir, target)
	f, err := os.Create(abs)
	if err != nil {
		return "", err
	}
	_, cpErr := io.Copy(f, r)
	closeErr := f.Close()
	if cpErr != nil {
		return "", cpErr
	}
	if closeErr != nil {
		return "", closeErr
	}

	// markdown path relative to the current post file
	postAbs, err := safeJoin(s.ContentRoot(), postRel)
	if err != nil {
		return "", fmt.Errorf("请先打开一篇文章再上传")
	}
	rel, err := filepath.Rel(filepath.Dir(postAbs), abs)
	if err != nil {
		return "", err
	}
	rel = filepath.ToSlash(rel)

	if kind == "image" {
		return fmt.Sprintf("![%s](%s)", stem, rel), nil
	}
	return fmt.Sprintf("[%s](%s)", target, rel), nil
}

// sanitizeName replaces unsafe chars in an uploaded filename.
func sanitizeName(s string) string {
	s = strings.TrimSpace(s)
	s = filepath.Base(s) // strip any path parts
	var b strings.Builder
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			if r < 128 {
				b.WriteRune(unicode.ToLower(r))
			} else {
				b.WriteRune(r)
			}
		case r == '-' || r == '_' || r == '.':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	out := b.String()
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	return strings.Trim(out, "-")
}

// ---------- front matter helpers ----------

// SplitFrontMatter strips a leading yaml(+++)/toml(+++) block.
func SplitFrontMatter(src string) (fm, body string) {
	lines := strings.Split(src, "\n")
	if len(lines) < 2 {
		return "", src
	}
	marker := lines[0]
	if marker == "---" || marker == "+++" {
		for i := 1; i < len(lines); i++ {
			line := strings.TrimRight(lines[i], "\r")
			if line == marker || strings.TrimSpace(line) == marker {
				return strings.Join(lines[1:i], "\n"), strings.Join(lines[i+1:], "\n")
			}
		}
	}
	return "", src
}

// ParseMeta turns a front matter block into a string map.
func ParseMeta(fm string) map[string]string {
	out := map[string]string{}
	keyRe := regexp.MustCompile(`^([A-Za-z][\w-]*)\s*:\s*(.*)$`)
	dateRe := regexp.MustCompile(`\d{4}-\d{2}-\d{2}`)
	for _, line := range strings.Split(fm, "\n") {
		m := keyRe.FindStringSubmatch(strings.TrimSpace(line))
		if m == nil {
			continue
		}
		key := strings.ToLower(m[1])
		val := strings.TrimSpace(m[2])
		val = strings.Trim(val, `"'`)
		switch key {
		case "title":
			if _, ok := out["title"]; !ok {
				out["title"] = val
			}
		case "date":
			if mm := dateRe.FindString(val); mm != "" {
				out["date"] = mm
			}
		case "draft":
			out["draft"] = val
		}
	}
	return out
}

func Truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "yes", "1", "t":
		return true
	}
	return false
}

// TitleFromBody picks the first `# heading` (before any code fence),
// else the cleaned filename.
func TitleFromBody(body, fileName, relPath string) string {
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		l := strings.TrimSpace(line)
		if strings.HasPrefix(l, "```") || strings.HasPrefix(l, "~~~") {
			break // 别从代码块里捡标题
		}
		if strings.HasPrefix(l, "# ") {
			return strings.TrimSpace(l[2:])
		}
	}
	name := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	if name == "_index" || name == "index" {
		// hugo leaf bundle: use the parent directory as title
		dir := filepath.Base(filepath.Dir(filepath.ToSlash(relPath)))
		if dir != "." && dir != "/" {
			name = dir
		}
	}
	if len(name) > 10 && isAllDigits(name[:4]) {
		if name[4] == '-' {
			name = name[11:]
		}
	}
	return name
}
