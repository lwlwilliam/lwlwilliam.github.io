# lwlwilliam.github.io

基于 [Hugo](https://gohugo.io/) 的个人博客，构建结果发布在 GitHub Pages。

## 快速开始

```bash
# 安装 Hugo extended
brew install hugo            # macOS
choco install hugo-extended  # Windows

# 本地预览
hugo server -D

# 构建到 docs/（GitHub Pages 发布目录）
hugo --cleanDestinationDir --minify
```

`docs/` 是生成产物，不要直接修改；所有源文件都在仓库根目录的其他目录中。

## 目录结构

```
.
├── assets/                 # Hugo Pipes 资源（CSS / 页面级 JS）
│   ├── css/main.css        # 全站设计变量、组件与响应式样式
│   └── js/
│       ├── main.js         # 主题、导航、搜索、TOC 等通用行为
│       └── tools.js        # /tools/ 页面的 iframe 标签页行为
├── content/
│   ├── posts/              # 文章（按年份分目录）
│   ├── about/              # 关于页
│   ├── archives/           # 归档页
│   ├── books/              # 书架页
│   ├── categories/         # 分类总览页
│   ├── links/              # 友情链接页
│   ├── todo/               # 待办页
│   └── tools/              # 工具总览页
├── data/                   # 页面数据
│   ├── books.yml           # technical / other 两组书架数据
│   ├── links.yml
│   ├── todo.yml
│   └── tools.yml
├── layouts/
│   ├── _default/
│   │   ├── baseof.html     # HTML 骨架
│   │   ├── single.html     # 文章详情
│   │   └── _markup/        # 图片与链接的 Markdown render hooks
│   ├── partials/           # header / footer / search / card / year-toc 等
│   ├── index.html          # 首页
│   └── <section>/list.html # 各功能页模板
├── static/                 # 原样复制到输出目录的静态资源
│   ├── assets/images/      # 文章图片
│   ├── assets/files/       # 下载文件
│   ├── katex/              # 按需加载的 KaTeX
│   └── tools/              # 可独立打开的工具页面
├── blog-editor/            # 本地 Go 写作工具（不参与站点构建）
├── _draft/                 # 未发布草稿（Hugo 不处理）
├── hugo.toml               # 站点配置
└── docs/                   # 构建产物（GitHub Pages）
```

## 写文章

文章放在 `content/posts/<年份>/` 下，文件名推荐 `YYYY-MM-DD-slug.md`：

```markdown
---
date: 2026-01-07
title: 文章标题
categories: [分类1, 分类N]
keywords: [关键词1, 关键词N]
---

正文从这里开始。
```

- `date` 决定排序，并用于固定链接 `/:year/:month/:day/:slug/`。
- `categories` 用于分类页与文章标签。
- `keywords` 会显示在文章标题下方，同时写入 SEO meta。
- 需要数学公式时添加 `enableKatex: true`，页面才会加载 KaTeX。
- 文章目录（h2–h4）在存在标题时自动生成，并随阅读位置高亮。

### 图片和下载文件

推荐使用站点根路径，构建时会自动转换为适合当前页面的相对地址：

```markdown
![图片说明](/assets/images/example.png)
[下载文件](/assets/files/example.zip)
```

对应的源文件位置分别是 `static/assets/images/` 和 `static/assets/files/`。旧的
`../../../static/assets/...` 写法仍由 render hook 兼容。

> 直接在 Markdown 中写 HTML 时不会经过 render hook，资源地址请使用
> `/assets/...` 根路径，Hugo 会将其转换为相对地址。

### 代码块

````markdown
```php
echo "Hello World";
```
````

代码高亮使用 `monokai` 主题，代码块右上角会自动出现“复制”按钮。

## 页面与数据

| 页面 | 数据文件 | 说明 |
|------|----------|------|
| `/links/` | `data/links.yml` | `name`、`url` |
| `/books/` | `data/books.yml` | `technical`、`other` 两组，按年份组织 |
| `/tools/` | `data/tools.yml` | `file_name`、`name`、`desc` |
| `/todo/` | `data/todo.yml` | `name`、可选 `remark` |

### 添加工具

1. 在 `static/tools/` 放入独立 HTML 页面。
2. 在 `data/tools.yml` 增加条目：

```yaml
- file_name: my-tool
  name: 我的工具
  desc: 这个工具用来做某事
```

工具页会优先在 `/tools/` 内用标签页打开；链接仍支持新标签页直接访问。

## 导航与配置

导航使用 Hugo 标准菜单，在 `hugo.toml` 中增删 `[[menus.main]]`：

```toml
[[menus.main]]
  name = 'New Page'
  pageRef = '/new-page'
  weight = 9
```

主要配置：

| 配置 | 作用 |
|------|------|
| `publishDir = "docs"` | 输出到 GitHub Pages 目录 |
| `relativeURLs = true` | 生成可在子路径和本地文件协议下使用的相对链接 |
| `pagination.pagerSize` | 首页与分类页每页文章数 |
| `params.paginationWindow` | 分页器页码窗口 |
| `params.excerptLength` | 文章摘要长度 |
| `markup.highlight.style` | 代码高亮主题 |
| `markup.tableOfContents` | 文章目录层级范围 |
| `permalinks.posts` | 文章固定链接格式 |

CSS 与 JS 通过 Hugo Pipes 自动压缩、添加内容哈希并带 SRI 校验，不需要手动维护版本参数。

## 功能

- 低饱和浅蓝主题，支持亮色 / 暗色模式并记忆偏好
- 响应式导航与移动端菜单
- 全站文章搜索（`Ctrl/⌘ K`），搜索索引在首次打开时加载
- 分类、年份归档、文章目录与滚动高亮
- 上一页 / 下一页、分页跳转、回到顶部
- 图片懒加载、代码一键复制、视频按需加载
- RSS 与按需 KaTeX
