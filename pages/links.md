---
layout: page
title: Links
description: 没有链接的博客是孤独的
keywords: 友情链接
comments: false
menu: Links
permalink: /links/
---


{% for link in site.data.links %}
<span>&#x1f4ce;&nbsp;&nbsp;</span><a href='{{ link.url }}' target='_blank'>{{ link.name }}</a>
{% endfor %}
