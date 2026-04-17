# Hugo 博客使用说明

## 项目结构

```
.
├── content/              # 内容文件
│   ├── posts/           # 博客文章
│   ├── about/           # 关于页面
│   ├── archives/        # 归档页面
│   ├── categories/      # 分类页面
│   ├── books/           # 书籍页面
│   ├── links/           # 链接页面
│   ├── tools/           # 工具页面
│   └── todo/            # 待办事项页面
├── data/                # 数据文件
│   ├── books.yml        # 技术书籍
│   ├── links.yml        # 友情链接
│   ├── other_books.yml  # 闲书
│   ├── todo.yml         # 待办事项
│   └── tools.yml        # 工具列表
├── static/              # 静态文件
│   ├── assets/          # 资源文件（图片等）
│   └── tools/           # 前端工具
├── themes/modern-blog/  # 自定义主题
└── hugo.toml           # 配置文件
```

## 功能特性

1. **现代化设计** - 简洁大方的界面，圆角设计
2. **亮/暗主题切换** - 支持主题切换，自动保存用户选择
3. **响应式布局** - 适配各种设备屏幕
4. **全站搜索** - 本地JavaScript搜索，支持标题和内容搜索
5. **分页功能** - 支持多种分页方式（页码、输入跳转等）
6. **卡片式展示** - 书籍、链接、工具等页面使用卡片展示
7. **归档和分类** - 按年份和分类组织文章
8. **Markdown渲染** - 支持代码高亮、数学公式等
9. **RSS订阅** - 自动生成feed.xml

## 使用方法

### 开发环境

```bash
# 启动开发服务器
hugo server --buildDrafts

# 访问 http://localhost:1313
```

### 构建网站

```bash
# 生成静态文件到public目录
hugo

# 构建并启用草稿
hugo --buildDrafts
```

### 添加新文章

```bash
# 创建新文章
hugo new posts/年-月-日-文章标题.md

# 编辑文章内容
# 文章会自动出现在首页和相应分类中
```

### 文章Front Matter格式

```yaml
---
title: "文章标题"
date: 2024-01-01
categories: ["分类1", "分类2"]
tags: ["标签1", "标签2"]
keywords: "关键词1;关键词2"
---
```

## 配置说明

主要配置在 `hugo.toml` 文件中：

- `baseURL`: 网站基础URL
- `title`: 网站标题
- `theme`: 使用的主题
- `params`: 自定义参数
  - `author`: 作者信息
  - `navs`: 导航菜单
  - `paginate`: 每页文章数量

## 数据文件格式

### books.yml (书籍数据)

```yaml
2024:
  - name: 书名
    info: ISBN或链接
    complete: true/false  # 是否已读完
    collect: true/false   # 是否收藏
```

### links.yml (链接数据)

```yaml
- name: 链接名称
  url: 链接地址
```

### tools.yml (工具数据)

```yaml
- file_name: 工具文件名（不带.html）
  name: 工具名称
```

## 部署

### GitHub Pages

```bash
# 构建网站
hugo

# 将public目录内容推送到gh-pages分支
cd public
git init
git add .
git commit -m "Deploy Hugo site"
git branch -M main
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### 自定义域名

将 `CNAME` 文件放在 `static/` 目录中，内容为域名：
```
example.com
```

## 主题定制

主题文件位于 `themes/modern-blog/`：

- `layouts/`: 页面模板
- `assets/css/main.css`: 主题样式
- `assets/js/main.js`: 主题JavaScript

可以修改这些文件来自定义主题外观和功能。

## 注意事项

1. 文章中的图片等资源请放在 `static/assets/` 目录下
2. 前端工具放在 `static/tools/` 目录下
3. 数据文件使用YAML格式，注意缩进
4. 主题切换功能依赖localStorage，需要现代浏览器支持