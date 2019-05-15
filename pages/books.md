---
layout: page
title: Books
description: 
keywords: 阅读清单
comments: true
menu: 阅读
permalink: /books/
---



这几年看过的一些书


{% for year in site.data.books %}

> {{ year[0] }}


{{ assign count = 1 }}
{% for book in year[1] %}
{{ forloop.index0 }}.       <span>{{ book.name }}</span> <span style="color:grey;font-size:12px;vertical-align:middle;">[{{ book.remark }}]</span>
{% endfor %}


{% endfor %}
