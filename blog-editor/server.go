package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:web
var webFS embed.FS

func newServer(site *Site) http.Handler {
	mux := http.NewServeMux()
	api := &APIService{site: site}
	api.Register(mux)

	// serve real site root read-only for the preview iframe (/preview/...)
	mux.Handle("GET /preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir(site.Root))))

	// embed the SPA UI
	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		panic(err)
	}
	mux.Handle("/", http.FileServer(http.FS(sub)))
	return mux
}
