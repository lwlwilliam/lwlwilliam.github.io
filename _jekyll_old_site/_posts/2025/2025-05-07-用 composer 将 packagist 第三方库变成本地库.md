---
title: 用 composer 将 packagist 第三方库变成本地库
layout: post
categories: [PHP]
keywords: PHP
---

之所以有这个想法，是因为部分第三方库版本约束没有做好，导致版本不匹配的库也可以安装，库版本不兼容到运行时才得以暴露，影响很大。

以`workerman/mqtt`为例，`2.1`版本跟`workerman/workerman:^4.0`是不兼容的，但 [composer.json](https://github.com/walkor/mqtt/blob/v2.1/composer.json#L34) 的`require`是`"workerman/workerman" : "^4.0 | ^5.0"`。当然直接`composer require workerman/mqtt:2.1`是没有问题的，如果是在已有的`workerman/workerman:^4.0`项目中`require`可以安装`2.1`版本，但运行时就会产生不兼容的错误提示。

```
Fatal error: Declaration of Workerman\Mqtt\Protocols\Mqtt::input(string $buffer, Workerman\Connection\ConnectionInterface $connection): int must be compatible with Workerman\Protocols\ProtocolInterface::input($recv_buffer, Workerman\Connection\ConnectionInterface $connection) in /usr/share/php/programming_practice/php/php-frameworks-test/workerman4_mqtt2/vendor/workerman/mqtt/src/Protocols/Mqtt.php on line 136
```

如果第三方库没有及时修改，我们就需要自己来调整一下。`composer`默认会从`packagist`查询依赖地址并依此下载，在将第三方库变成本地库时，可以沿用`composer`的依赖加载机制。

首先将有问题的库移出`vendor`目录统一放到项目根目录的`third_party`目录中，并将当前使用的库版本`"version": "2.1"`记录到库的`composer.json`中，再将`workerman/workerman`的版本约束改为`^5.0`。

```bash
$ mkdir third_party
$ mv vendor/workerman/mqtt third_party
$ vim third_party/mqtt/composer.json
{
    "version": "2.1",
    "require": {
        "php": "^8.0",
        "workerman/workerman" : "^5.0"
    },
    // ... 此处省略其它 key:value
}
```

接着给项目的`composer.json`添加搜索本地路径的键值对。

```bash
$ vim composer.json
{
    "repositories": [
        {
            "type": "path",
            "url": "./third_party/mqtt"
        }
    ],
    // ... 此处省略其它 key:value
}
```

现在可以再次`composer require workerman:mqtt:2.1`了，得到以下提示：

```
Your requirements could not be resolved to an installable set of packages.

  Problem 1
    - Root composer.json requires workerman/mqtt 2.1 -> satisfiable by workerman/mqtt[2.1].
    - workerman/mqtt 2.1 requires workerman/workerman ^5.0 -> found workerman/workerman[v5.0.0, v5.0.1, v5.1.0, v5.1.1] but it conflicts with your root composer.json require (^4.0).

Use the option --with-all-dependencies (-W) to allow upgrades, downgrades and removals for packages currently locked to specific versions.
```

这就对了，说明目前使用的就是本地的`third_party/mqtt`库，版本约束应该让`composer`检查，防患于未然。不要不兼容的库都可以安装，这样会出大问题的。

另外，`composer`还支持指定私有仓库，也就是可以直接将`mqtt`放到自己的`git`仓库中，如下指定仓库地址即可，注意加个新的`tag`作为版本号，总体上比本地库方便得多，这里就不展开了。

```json
{
    "repository": [
        {
            "type": "vcs",
            "url": "https://github.com/xxx/mqtt"
        }
    ]
    // ... 省略其它 key:value
}
```