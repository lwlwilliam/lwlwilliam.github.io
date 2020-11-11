---
layout: categories
title: Categories
description: 哈哈，你找到了我的文章基因库
keywords: 分类
comments: false
menu: Categories
permalink: /categories/
---

<style>
li {
    list-style-type: "📄  ";
}
</style>

<section class="container posts-content">
{% assign sorted_categories = site.categories | sort %}
{% for category in sorted_categories %}
    <blockquote>{{ category | first }}</blockquote>
    <ol class="posts-list" id="{{ category[0] }}">
        {% for post in category.last %}
            <li class="posts-list-item">
                <span class="posts-list-meta">{{ post.date | date:"%Y-%m-%d" }}</span>
                <a class="posts-list-name" href="{{ site.url }}{{ post.url }}">{{ post.title }}</a>
            </li>
        {% endfor %}
    </ol>
{% endfor %}
</section>
<!-- /section.content -->