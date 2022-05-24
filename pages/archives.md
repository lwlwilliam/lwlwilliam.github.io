---
layout: page
title: Archives
description: 按年份归档
keywords: 归档
comments: false
menu: Archives
permalink: /archives/
---

<section class="container posts-content">

{% assign count = 1 %}
{% for post in site.posts reversed %}
    {% assign year = post.date | date: '%Y' %}
    {% assign nyear = post.next.date | date: '%Y' %}
    {% if year != nyear %}
        {% assign count = count | append: ', ' %}
        {% assign counts = counts | append: count %}
        {% assign count = 1 %}
    {% else %}
        {% assign count = count | plus: 1 %}
    {% endif %}
{% endfor %}

{% assign counts = counts | split: ', ' | reverse %}
{% assign i = 0 %}
{% assign thisyear = 1 %}

{% for post in site.posts %}
    {% assign year = post.date | date: '%Y' %}
    {% assign nyear = post.next.date | date: '%Y' %}
    {% if year != nyear %}
        {% if thisyear != 1 %}
            </div>
        {% endif %}
            <blockquote style="font-size: 1.5rem;">{{ post.date | date: '%Y' }}<span class="title-badge">{{ counts[i] }}</span></blockquote>
        {% if thisyear != 0 %}
            {% assign thisyear = 0 %}
        {% endif %}
        <div class="posts-list">
        {% assign i = i | plus: 1 %}
    {% endif %}
    
<div class="posts-list-item">
    <span class="posts-list-meta">{{ post.date | date:"%m-%d" }}</span>
    <a class="posts-list-name" href="{{ site.url }}{{ post.url }}">{{ post.title }}</a>
</div>
{% endfor %}
</div>
</section>
