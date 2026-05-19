#!/usr/bin/env python3
"""
Hugo 博客文章生成器
用法: python new_post.py "文章标题" "分类名称"
"""

import sys
import os
from datetime import datetime


def create_hugo_post(title, category):
    """
    创建 Hugo 博客文章

    Args:
        title: 文章标题
        category: 文章分类
    """
    # 获取当前日期
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    date_str = now.strftime("%Y-%m-%d")

    # 生成文件名：年份-月份-日-标题.md
    # 将标题中的空格替换为连字符，并转换为小写
    title_slug = title.lower().replace(" ", "-")
    filename = f"{year}-{month}-{day}-{title_slug}.md"

    # 创建目录路径
    posts_dir = os.path.join("content", "posts", year)

    # 递归创建目录（如果不存在）
    os.makedirs(posts_dir, exist_ok=True)

    # 完整的文件路径
    filepath = os.path.join(posts_dir, filename)

    # 检查文件是否已存在
    if os.path.exists(filepath):
        print(f"错误：文件已存在 - {filepath}")
        sys.exit(1)

    # 生成文章内容
    content = f"""---
date: {date_str}
title: {title}
categories: [{category}]
keywords: []
---

"""

    # 写入文件
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 成功创建文章：{filepath}")
        print(f"   标题：{title}")
        print(f"   分类：{category}")
        print(f"   日期：{date_str}")
    except Exception as e:
        print(f"❌ 创建文件失败：{e}")
        sys.exit(1)


def main():
    # 检查命令行参数
    if len(sys.argv) != 3:
        print("用法: python new_post.py \"文章标题\" \"分类名称\"")
        print("示例: python new_post.py \"我的第一篇博客\" \"技术\"")
        sys.exit(1)

    title = sys.argv[1]
    category = sys.argv[2]

    # 创建文章
    create_hugo_post(title, category)


if __name__ == "__main__":
    main()