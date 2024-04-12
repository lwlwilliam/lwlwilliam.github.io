#!/usr/bin/env python
# 创建博客 markdown 文件脚本，哈哈，一点事情都不想多做
import os
import sys
import time
import traceback

if len(sys.argv) != 3:
    print('Usage: python post.py title category')
    exit(-1)

try:
    title = sys.argv[1]
    category = sys.argv[2]
    t = time.localtime()
    file_name = f'{t.tm_year}-{t.tm_mon:02d}-{t.tm_mday:02d}-{title}.md'

    # 创建目录
    d = f'_posts/{t.tm_year}/'
    if not os.path.exists(d):
        os.makedirs(d, 0o744, True)

    fd = open(f'{d}{file_name}', 'a+')
    fd.write(f'''---
title: {title}
layout: post
categories: [category]
keywords: {category}
---''')
    fd.close()
except:
    traceback.print_exc()
