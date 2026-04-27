### Github Pages

[https://lwlwilliam.github.io](https://lwlwilliam.github.io)

`jekyll`使用的模板引擎是 [Liquid](https://shopify.github.io/liquid/) 。

```bash
$ cd repoDir
$ bundle exec jekyll serve # 或者 ./run.sh 启动
```

然后就可以通过 [http://localhost:4000](http://localhost:4000)本地访问了。

或者可以通过`docker pull lwlwufeng/jekyll`直接使用搭建好的`jekyll`镜像环境。

#### 创建 markdown 博客脚本

要求：`python`

```
$ python post.py 文章标题 分类名称
```

#### 使用 mathjax

页面中加上`mathjax: true`配置。

#### 关于原生代码被 liquid 模板覆盖问题

在需要使用原生代码的地方使用`{% raw %}`和`{% endraw %}`一前一后包裹住，如：

```
{% raw %}
{{ env.PATH }}
{% endraw %}
```