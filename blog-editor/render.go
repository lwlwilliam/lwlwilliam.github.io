package main

import (
	"bytes"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"unicode/utf8"

	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/yuin/goldmark"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

// RenderPreview converts a markdown body (front matter already handled) to HTML.
// Relative asset links are rewritten so that they load from the local static tree.
func RenderPreview(site *Site, relPath, body string) (string, error) {
	base := site.ContentRoot()
	if relPath != "" {
		if abs, err := safeJoin(site.ContentRoot(), relPath); err == nil {
			base = filepath.Dir(abs)
		}
	}
	// be defensive: strip front matter again if present
	if fm, b := SplitFrontMatter(body); fm != "" {
		body = b
	}
	res := &urlResolver{root: site.Root, base: base}
	body = protectMath(body)

	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.Footnote,
			extension.Typographer,
			extension.DefinitionList,
			highlighting.NewHighlighting(
				highlighting.WithStyle("monokai"),
				highlighting.WithFormatOptions(chromahtml.WithClasses(true)),
				highlighting.WithWrapperRenderer(wrapperRenderer),
			),
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
			parser.WithASTTransformers(util.Prioritized(&destTransformer{res: res}, 100)),
		),
		goldmark.WithRendererOptions(
			html.WithUnsafe(),
			renderer.WithNodeRenderers(util.Prioritized(&blockRewriter{res: res}, 100)),
		),
	)
	var buf bytes.Buffer
	if err := md.Convert([]byte(body), &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ---------- URL resolving ----------

type urlResolver struct {
	root string // absolute site root
	base string // absolute dir of the markdown file being rendered
}

var urlSchemes = []string{
	"http", "https", "ftp", "mailto", "tel", "data", "blob", "ws", "wss", "javascript", "file",
}

// Destination rewrites a markdown link/image destination for the preview iframe.
func (r *urlResolver) Destination(dest string) string {
	if dest == "" || dest[0] == '#' {
		return dest
	}
	low := strings.ToLower(dest)
	for _, s := range urlSchemes {
		if strings.HasPrefix(low, s+":") {
			return dest
		}
	}
	frag := ""
	if i := strings.IndexByte(dest, '#'); i >= 0 {
		frag, dest = dest[i:], dest[:i]
	}
	head := derefPercent(dest)

	var p string
	if strings.HasPrefix(head, "/") {
		p = filepath.Join(r.root, filepath.FromSlash(head))
	} else {
		p = filepath.Join(r.base, filepath.FromSlash(head))
	}
	p = filepath.Clean(p)
	if !withinDir(r.root, p) {
		return dest + frag
	}
	if _, err := os.Stat(p); err != nil {
		return dest + frag
	}
	rel, err := filepath.Rel(r.root, p)
	if err != nil {
		return dest + frag
	}
	u := &url.URL{Path: "/preview/" + filepath.ToSlash(rel)}
	return u.String() + frag
}

// derefPercent decodes %xx escapes so on-disk paths can be stat-ed.
func derefPercent(s string) string {
	if !strings.Contains(s, "%") {
		return s
	}
	if d, err := url.PathUnescape(s); err == nil {
		return d
	}
	return s
}

func withinDir(root, p string) bool {
	root = filepath.Clean(root)
	if p == root {
		return true
	}
	return strings.HasPrefix(p, root+string(filepath.Separator))
}

type destTransformer struct {
	res *urlResolver
}

func (t *destTransformer) Transform(node *ast.Document, reader text.Reader, _ parser.Context) {
	_ = ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch k := n.(type) {
		case *ast.Image:
			k.Destination = []byte(t.res.Destination(string(k.Destination)))
		case *ast.Link:
			k.Destination = []byte(t.res.Destination(string(k.Destination)))
		}
		return ast.WalkContinue, nil
	})
}

// ---------- raw HTML renderers (URL rewriting for <video>/<img> etc.) ----------

var attrURLRe = regexp.MustCompile(`(?i)((?:src|href|poster|data-src)[[:space:]]*=[[:space:]]*)(["'])([^"']*)["']`)

func rewriteHTMLAttrURLs(h string, res *urlResolver) string {
	if res == nil || !strings.Contains(h, "=") {
		return h
	}
	return attrURLRe.ReplaceAllStringFunc(h, func(m string) string {
		g := attrURLRe.FindStringSubmatch(m)
		if g == nil {
			return m
		}
		attr, quote, val := g[1], g[2], g[3]
		newVal := res.Destination(val)
		if newVal == val {
			return m
		}
		return attr + quote + newVal + quote
	})
}

type blockRewriter struct {
	res *urlResolver
}

func (b *blockRewriter) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(ast.KindHTMLBlock, b.renderHTMLBlock)
	reg.Register(ast.KindRawHTML, b.renderRawHTML)
}

func (b *blockRewriter) renderHTMLBlock(
	w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	n := node.(*ast.HTMLBlock)
	if entering {
		lines := n.Lines()
		for i := 0; i < lines.Len(); i++ {
			seg := lines.At(i)
			b.secureWrite(w, rewriteHTMLAttrURLs(string(seg.Value(source)), b.res))
		}
	} else if n.HasClosure() {
		closure := n.ClosureLine
		b.secureWrite(w, rewriteHTMLAttrURLs(string(closure.Value(source)), b.res))
	}
	return ast.WalkContinue, nil
}

func (b *blockRewriter) renderRawHTML(
	w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkSkipChildren, nil
	}
	n := node.(*ast.RawHTML)
	l := n.Segments.Len()
	for i := 0; i < l; i++ {
		seg := n.Segments.At(i)
		b.secureWrite(w, rewriteHTMLAttrURLs(string(seg.Value(source)), b.res))
	}
	return ast.WalkSkipChildren, nil
}

// secureWrite replicates goldmark's SecureWrite (NUL replacement).
func (b *blockRewriter) secureWrite(w util.BufWriter, src string) {
	n := 0
	l := len(src)
	for i := 0; i < l; i++ {
		if src[i] == 0 {
			_, _ = w.WriteString(src[i-n : i])
			n = 0
			_, _ = w.Write([]byte{0xEF, 0xBF, 0xBD})
			continue
		}
		n++
	}
	if n != 0 {
		_, _ = w.WriteString(src[l-n:])
	}
}

func wrapperRenderer(w util.BufWriter, _ highlighting.CodeBlockContext, entering bool) {
	if entering {
		_, _ = w.WriteString(`<div class="highlight">`)
	} else {
		_, _ = w.WriteString("</div>\n")
	}
}

// ---------- chroma css ----------

var (
	chromaCSSOnce sync.Once
	chromaCSSData string
)

func ChromaCSS() string {
	chromaCSSOnce.Do(func() {
		fmtr := chromahtml.New(chromahtml.WithClasses(true))
		var buf bytes.Buffer
		if err := fmtr.WriteCSS(&buf, styles.Get("monokai")); err == nil {
			chromaCSSData = buf.String()
		}
	})
	return chromaCSSData
}

// ---------- math protection (hugo passthrough emulation) ----------
//
// Wraps $..$ / $$..$$ / \(..\) / \[..] into raw HTML spans so the goldmark
// parser cannot mangle math contents (e.g. underscores). KaTeX auto-render
// then picks the original delimiters from the rendered document.

func protectMath(src string) string {
	skips := fencedRanges(src)
	var b strings.Builder
	b.Grow(len(src) + 64)

	inSkip := func(pos int) (int, bool) {
		for _, r := range skips {
			if pos >= r[0] && pos < r[1] {
				return r[1], true
			}
		}
		return 0, false
	}

	i := 0
	for i < len(src) {
		if end, ok := inSkip(i); ok {
			b.WriteString(src[i:end])
			i = end
			continue
		}
		c := src[i]
		switch {
		case c == '`':
			j := i
			for j < len(src) && src[j] == '`' {
				j++
			}
			run := src[i:j]
			b.WriteString(run)
			i = j
			k := strings.Index(src[i:], run)
			if k >= 0 {
				_, skipped := inSkip(i + k)
				if !skipped {
					b.WriteString(src[i : i+k+len(run)])
					i += k + len(run)
					continue
				}
			}
		case c == '\\' && i+1 < len(src):
			switch src[i+1] {
			case '$', '`', '\\', '*', '_', '~', '#', '(', ')', '[', ']', '{', '}', '<', '>':
				// \$ is a markdown escape for a literal dollar -> copy pair.
				if src[i+1] == '$' || src[i+1] == '(' || src[i+1] == '[' {
					// check math delimiters first below
					if src[i+1] == '(' || src[i+1] == '[' {
						closer := "\\)"
						if src[i+1] == '[' {
							closer = "\\]"
						}
						if j := strings.Index(src[i+2:], closer); j >= 0 {
							full := src[i : i+2+j+2]
							if src[i+1] == '[' {
								b.WriteString(`<div class="math-display">` + full + `</div>`)
							} else {
								b.WriteString(`<span class="math-inline">` + full + `</span>`)
							}
							i = i + 2 + j + 2
							continue
						}
					}
				}
				b.WriteString(src[i : i+2])
				i += 2
				continue
			default:
				b.WriteByte('\\')
				i++
				continue
			}
		case c == '$':
			if strings.HasPrefix(src[i:], "$$") {
				if j := strings.Index(src[i+2:], "$$"); j >= 0 {
					full := src[i : i+2+j+2]
					b.WriteString(`<div class="math-display">` + full + `</div>`)
					i = i + 2 + j + 2
					continue
				}
			}
			if j := strings.IndexByte(src[i+1:], '$'); j > 0 {
				inner := src[i+1 : i+1+j]
				trimmed := strings.TrimSpace(inner)
				if trimmed != "" && !strings.Contains(inner, "\n") && !strings.Contains(inner, "`") {
					full := src[i : i+1+j+1]
					b.WriteString(`<span class="math-inline">` + full + `</span>`)
					i = i + 1 + j + 1
					continue
				}
			}
			b.WriteByte('$')
			i++
		default:
			_, size := utf8.DecodeRuneInString(src[i:])
			b.WriteString(src[i : i+size])
			i += size
		}
	}
	return b.String()
}

// fencedRanges returns byte ranges of fenced code blocks (``` / ~~~).
func fencedRanges(src string) [][2]int {
	var out [][2]int
	var fence string
	start := 0
	inFence := false
	off := 0

	commit := func(endIndex int) {
		if inFence {
			out = append(out, [2]int{start, endIndex})
		}
	}

	for off <= len(src) {
		nl := strings.IndexByte(src[off:], '\n')
		var lineEnd int
		var next int
		if nl < 0 {
			lineEnd = len(src)
			next = len(src) + 1
		} else {
			lineEnd = off + nl
			next = lineEnd + 1
		}
		line := src[off:lineEnd]
		trimmed := strings.TrimRight(line, "\r")
		t := strings.TrimSpace(trimmed)

		if inFence {
			if t == fence {
				commit(lineEnd)
				inFence = false
				fence = ""
			}
		} else if strings.HasPrefix(t, "```") || strings.HasPrefix(t, "~~~") {
			// only treat as fence opener when markers are at line start (<4 spaces)
			indent := 0
			for indent < len(trimmed) && (trimmed[indent] == ' ' || trimmed[indent] == '\t') {
				indent++
			}
			if indent <= 3 {
				start = off
				inFence = true
				fence = t[:3]
			}
		}
		if next > len(src) {
			break
		}
		off = next
	}
	commit(len(src))
	return out
}
