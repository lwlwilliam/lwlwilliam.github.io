---
layout: page
title: Books
description: 
keywords: 阅读清单
comments: true
menu: 阅读
permalink: /books/
---



这些年看过的一些书，部分有难度的未看完。


{% for year in site.data.books %}

> {{ year[0] }}

{% assign count = 1 %}
{% for book in year[1] %}
<span style="display:inline-block;text-indent:1em;">{{ forloop.index0 }}. </span>
<span>{{ book.name }}</span> 
<span style="color:grey;font-size:12px;vertical-align:middle;">[{{ book.info }}]</span>
{% if book.remark %}<span style="color:red;font-size:12px;vertical-align:middle;">【{{ book.remark }}】</span>{% endif %}
{% endfor %}

{% endfor %}
