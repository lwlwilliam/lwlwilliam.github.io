# lwlwilliam.github.io

基于 [Hugo](https://gohugo.io/) 构建的个人博客，托管于 GitHub Pages。

## 快速开始

```bash
# 安装 Hugo (extended 版本)
# macOS:   brew install hugo
# Windows: choco install hugo-extended

# 克隆仓库
git clone git@github.com:lwlwilliam/lwlwilliam.github.io.git
cd lwlwilliam.github.io

# 本地预览（默认端口 1313）
hugo server -D

# 构建（输出到 docs/ 目录）
hugo
```

构建后的静态文件在 `docs/` 目录，该目录即是 GitHub Pages 的发布根目录。

---

## 写博客

所有文章放在 `content/posts/` 目录下，按年份分文件夹。文件名格式：`YYYY-MM-DD-slug.md`。

### 文章模板

```markdown
---
date: 2025-03-05
title: 文章标题
categories: [分类1, 分类N]      # 可选，用于 /categories/ 页面分组
keywords: [关键词1, 关键词N]    # 可选，文章中不显示，仅用于 SEO
---

正文从这里开始。支持标准 Markdown 语法。
```

> **注意**：日期 `date` 是必填的，决定文章的时间排序。`slug` 从文件名自动提取，作为 URL 路径。

### 图片

将图片放到 `static/assets/images/` 目录，Markdown 中这样引用：

```markdown
![图片说明](/assets/images/example.png)
```

> `/assets/images/` 路径对应仓库根目录下的 `static/assets/images/` 文件夹。Hugo 构建时，`static/` 下的所有文件会原样复制到输出目录。

### 文件下载

将文件放到 `static/assets/files/` 目录，在 Markdown 中这样提供下载：

```markdown
[下载 PDF 文档](/assets/files/document.pdf)
```

### 代码块

````markdown
```php
echo "Hello World";
```

```python
def hello():
    print("Hello")
```
````

代码高亮使用 `monokai` 主题（配置在 `hugo.toml` 中）。

---

## 数学公式 (KaTeX)

默认不加载 KaTeX，只在需要时按页面启用。在文章 frontmatter 中添加：

```markdown
---
date: 2025-03-05
title: 某数学文章
categories: [数学]
keywords: [数学]
enableKatex: true        # 仅这篇文章加载 KaTeX
---
```

然后正常书写 LaTeX：

```markdown
行内公式：$E = mc^2$

块级公式：
$$
\sum_{i=1}^{n} x_i
$$
```

已加载的文章示例：`content/posts/2019/2019-04-01-浮点数表示.md`

---

## 文章目录 (TOC)

文章会自动从标题提取目录（范围：h2 ~ h4）。目录以可滚动标签 pill 的形式出现在文章标题下方：

- **移动端**（< 900px）：水平滚动的 pill 标签，只显示二级标题
- **桌面端**（≥ 900px）：展开的纵向列表，含 h2/h3/h4 完整层级，点击跳转并高亮

目录仅在有标题的文章中显示，无标题则自动隐藏。

---

## 特殊页面

以下页面通过 `data/` 目录下的 YAML 数据文件驱动，修改对应文件即可更新页面内容：

| 页面 | 数据文件 | 说明 |
|------|----------|------|
| `/links/` | `data/links.yml` | 友情链接，格式：`name: 名称`, `url: 地址` |
| `/books/` | `data/books.yml`, `data/other_books.yml` | 书籍列表 |
| `/tools/` | `data/tools.yml` | 工具卡片，格式：`file_name`, `name`, `desc` |
| `/todo/` | `data/todo.yml` | 待办事项列表 |

### 添加新工具

1. 将工具的 HTML 文件放入 `static/tools/`
2. 在 `data/tools.yml` 中添加条目：
```yaml
- file_name: my-tool        # 对应 static/tools/my-tool.html
  name: 我的工具
  desc: 这个工具用来做某事
```

---

## 导航栏

编辑 `hugo.toml` 中的 `[[params.navs]]` 数组即可增减导航项：

```toml
[[params.navs]]
  href = '/new-page/'
  label = 'New Page'
```

---

## 配置说明 (hugo.toml)

`hugo.toml` 已添加详细的中文注释，直接阅读文件即可理解每项配置的作用。关键配置项：

| 配置 | 作用 |
|------|------|
| `publishDir = "docs"` | 构建输出到 docs/（GitHub Pages 要求） |
| `params.paginate` | 首页每页显示文章数 |
| `params.paginationWindow` | 分页器显示的页码按钮数 |
| `params.excerptLength` | 文章摘要截取字数 |
| `markup.goldmark.renderer.unsafe` | 允许 Markdown 中直接写 HTML |
| `markup.tableOfContents.startLevel/endLevel` | 目录提取的标题层级范围 |
| `markup.highlight.style` | 代码高亮主题 |
| `permalinks.posts` | 文章 URL 格式 |

---

## 结构概览

```
.
├── hugo.toml              # Hugo 配置（含中文注释）
├── content/
│   ├── posts/             # 博客文章（按年份分文件夹）
│   ├── links/_index.md    # 友链页面
│   ├── books/_index.md    # 书籍页面
│   ├── tools/_index.md    # 工具页面
│   ├── todo/_index.md     # 待办页面
│   ├── about/_index.md    # 关于页面
│   ├── archives/_index.md # 归档页面
│   └── categories/_index.md # 分类页面
├── layouts/               # 模板文件
│   ├── _default/
│   │   ├── baseof.html    # HTML 骨架（header、footer、搜索等）
│   │   ├── single.html    # 文章详情页（含 TOC）
│   │   └── list.html      # 默认列表页
│   ├── index.html         # 首页
│   ├── partials/          # 可复用部件
│   ├── links/             # 友情链接模板
│   ├── books/             # 书籍模板
│   ├── tools/             # 工具模板
│   ├── todo/              # 待办模板
│   ├── about/             # 关于模板
│   ├── archives/          # 归档模板
│   └── categories/        # 分类模板
├── static/
│   ├── assets/
│   │   ├── css/main.css   # 全局样式
│   │   ├── js/main.js     # 全局脚本（搜索、主题切换）
│   │   ├── images/        # 图片资源
│   │   └── files/         # 可下载文件
│   ├── katex/             # KaTeX 数学渲染库
│   └── tools/             # 独立工具页面（HTML）
├── data/                  # YAML 数据文件
│   ├── links.yml
│   ├── books.yml
│   ├── other_books.yml
│   ├── tools.yml
│   └── todo.yml
└── docs/                  # 构建输出（GitHub Pages 根目录）
```

---

## 功能特性

- **暗色/亮色主题**：右上角切换，自动记住偏好
- **全文搜索**：点击🔍或按 `Ctrl+K` 搜索所有文章内容
- **分类归档**：`/categories/` 按分类浏览，`/archives/` 按年份归档
- **RSS 订阅**：`/feed.xml`
- **文章目录**：自动生成并固定显示，点击跳转
- **上一页/下一页**：文章底部自动导航
- **分页**：首页支持页码跳转
- **数学公式**：按需加载 KaTeX（`enableKatex: true`）
