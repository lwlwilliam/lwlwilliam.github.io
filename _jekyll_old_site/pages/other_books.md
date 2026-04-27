---
layout: page
title: Other Books
description: 书
keywords: 阅读清单
comments: true
menu: Other Books
permalink: /other_books/
---

这些年读过的一些书（不全是出版书籍）。由于水平不够以及时间分配问题，部分未读完。

{% for year in site.data.other_books %}

{% assign count = 0 %}

{% for book in year[1] %}
{% assign count = count | plus:1 %}
{% endfor %}

{% assign counts = counts | append:count %}
{% assign counts = counts | append:',' %}

{% endfor %}



{% assign counts = counts | split:',' %}
{% assign i = 0 %}

{% for year in site.data.other_books %}

<blockquote style="font-size: 1.5rem;">{{ year[0] }}<span class="title-badge">{{ counts[i] }}</span></blockquote>

{% assign count = 1 %}
{% for book in year[1] %}

<span style="display:inline-block;text-indent:1em;width: 40px;">{{ forloop.index0 }}.</span>
<span>{% if book.remark %}&#x2705;{% else %}&#x1f4d6;{% endif %}&nbsp;</span>
<span>{{ book.name }}</span> 
<span style="color:grey;font-size:10px;vertical-align:middle;"> {{ book.info }}</span>
<span>{% if book.collect %}&#x2764;{% endif %}</span><!--五角星收藏表情，不过有点不像。&#x2b50;-->

{% endfor %}

{% assign i = i | plus: 1 %}

{% endfor %}
