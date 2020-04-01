---
layout: page
title: Links
description: 没有链接的博客是孤独的
keywords: 友情链接
comments: false
menu: 链接
permalink: /links/
---


{% for link in site.data.links %}
* <a href='{{ link.url }}' target='_blank'>{{ link.name }}</a>
{% endfor %}
