---
title: "搜索数据"
type: "search"
layout: "search"
outputs: ["SearchJSON"]
---

{{ $pages := where .Site.RegularPages "Type" "posts" }}
[
{{ range $index, $page := $pages }}
  {
    "title": {{ $page.Title | jsonify }},
    "url": {{ $page.RelPermalink | jsonify }},
    "content": {{ $page.Plain | jsonify }},
    "date": {{ $page.Date.Format "2006-01-02" | jsonify }},
    "categories": {{ $page.Params.categories | jsonify }}
  }{{ if ne $index (sub (len $pages) 1) }},{{ end }}
{{ end }}
]