---
layout: page
title: Todo
keywords: Todo
description: 任务列表
comments: false
menu: Todo
permalink: /todo/
---

{% for item in site.data.todo %}

<!--
<span style="display:inline-block;text-indent:1em;">{{ forloop.index0 }}. </span>
-->

<span>&#x23f3;&nbsp;&nbsp;</span>
<span>{{ item.name }}</span> 
{% if item.remark %}<span style="color:grey;font-size:12px;vertical-align:middle;">[{{ item.remark }}]</span>{% endif %}

{% endfor %}
