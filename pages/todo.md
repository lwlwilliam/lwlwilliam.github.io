---
layout: page
title: Todo
comments: false
menu: Todo
permalink: /todo/
---

{% for item in site.data.todo %}

<span style="display:inline-block;text-indent:1em;">{{ forloop.index0 }}. </span>
<span>{{ item.name }}</span> 
{% if item.remark %}<span style="color:grey;font-size:12px;vertical-align:middle;">[{{ item.remark }}]</span>{% endif %}

{% endfor %}
