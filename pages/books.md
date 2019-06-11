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


{% for year in site.data.books reversed %}

> {{ year[0] }}

<table>
<tbody>

{{ assign count = 1 }}
{% for book in year[1] %}

<tr>
    <td>
        <span style="display:inline-block;margin-right:5px;">{{ forloop.index0 }}.</span>
        <span>{{ book.name }}</span> 
        <span style="color:grey;font-size:12px;vertical-align:middle;">[{{ book.info }}]</span>
        {% if book.remark %}<span style="color:red;font-size:12px;vertical-align:middle;">【{{ book.remark }}】</span>{% endif %}
    </td>
</tr>

{% endfor %}

</tbody>
</table>

{% endfor %}
