package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRenderPostFrontMatterQuotesYAMLScalars(t *testing.T) {
	got := renderPostFrontMatter("2026-01-02", `A: "B" # [x]`, `C: [D]`)
	for _, want := range []string{
		"date: 2026-01-02\n",
		`title: "A: \"B\" # [x]"` + "\n",
		`categories: ["C: [D]"]` + "\n",
		`keywords: ["C: [D]"]` + "\n",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("front matter %q does not contain %q", got, want)
		}
	}
}

func TestRenderPostFrontMatterOmitsEmptyCategory(t *testing.T) {
	got := renderPostFrontMatter("2026-01-02", "Hello", "")
	if strings.Contains(got, "categories:") || strings.Contains(got, "keywords:") {
		t.Fatalf("empty category should omit taxonomy fields: %q", got)
	}
}

func TestUploadWithoutPostDoesNotCreateStaticFiles(t *testing.T) {
	root := t.TempDir()
	site := &Site{Root: root, ContentDir: "content", StaticDir: "static"}

	_, err := site.Upload("image", "test.png", strings.NewReader("image"), "")
	if err == nil {
		t.Fatal("expected upload without an open post to fail")
	}
	if _, statErr := os.Stat(filepath.Join(root, "static")); !os.IsNotExist(statErr) {
		t.Fatalf("upload should not create static files before validation; stat error = %v", statErr)
	}
}
