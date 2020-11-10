---
layout: page
title: Books
description: 
keywords: 阅读清单
comments: true
menu: Books
permalink: /books/
---



这些年看过的一些书，部分未看完。


{% for year in site.data.books %}

> {{ year[0] }}

{% assign count = 1 %}
{% for book in year[1] %}
<span style="display:inline-block;text-indent:1em;width: 40px;">{{ forloop.index0 }}.</span>
<span>{% if book.remark %}&#x2705;{% else %}&#x27a1;{% endif %}</span>
<span>{{ book.name }}</span> 
<span style="color:grey;font-size:10px;vertical-align:middle;"> {{ book.info }}</span>
<span>{% if book.collect %}&#x2b50;{% endif %}</span>
{% endfor %}

{% endfor %}
