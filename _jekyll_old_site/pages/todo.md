---
layout: page
title: Todo
keywords: Todo
description: 任务列表
comments: false
menu: Todo
permalink: /todo/
---

<style>
.todo-item-remark {
    color:grey;
    font-size:12px;
    vertical-align:middle;
}
</style>

{% for item in site.data.todo %}

<!--
<span style="display:inline-block;text-indent:1em;">{{ forloop.index0 }}. </span>
-->

<span>&#x23f3;&nbsp;&nbsp;</span> <span>{{ item.name }}</span> {% if item.remark %}<span class="todo-item-remark">[{{ item.remark }}]</span>{% endif %}

{% endfor %}
