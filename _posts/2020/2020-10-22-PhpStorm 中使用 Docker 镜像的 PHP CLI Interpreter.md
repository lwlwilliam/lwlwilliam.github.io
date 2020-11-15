---
title: PhpStorm 中使用 Docker 镜像的 PHP CLI Interpreter
layout: post
categories: [工具, PHP]
keywords: phpstorm, docker, interpreter
---

自学 PHP 以来，除了初学时期，一直都不太喜欢用集成环境如 MAMP、WAMP 之类的，这些工具虽然用起来很方便，但不符合我折腾的个性，而且灵活性有所欠缺，还可能会降低自己的好奇心；当然重要的是服务器一般也不会使用集成环境。这不，PHP 又出新版本了，想尝尝鲜，集成工具没有更新，不就得自己折腾么。

Docker 自定义 PHP 镜像的步骤就不细说了，我已经准备好了，这里用的是`lwlwufeng/php:7.1-fpm`。下面说说 PhpStorm，这 IDE，真是越用越喜欢，越用越觉得强大，还有很多功能有待我折腾。

这次之所以集成 Docker 的 PHP CLI Interpreter 进来，主要是为了保持环境的一致性，另外就是 PHP 有些扩展在 Mac 或者 Windows 下实现是不太方便甚至不能安装。以下就是完整的步骤，全是图，照做就完事了。

1.  点击`...`按钮。

    ![...](/assets/images/2020/1022/WX20201022-121356.png)

2.  从 Docker 添加。

    ![添加](/assets/images/2020/1022/WX20201022-121513.png)

3.  选择 Docker 及 PHP 镜像。

    ![镜像](/assets/images/2020/1022/WX20201022-121554.png)

4.  选择对应的 PHP 版本。

    ![PHP版本](/assets/images/2020/1022/WX20201022-121755.png)

现在就可以通过 Run 按钮来运行 PHP 脚本了。效果如下：

![效果](/assets/images/2020/1022/WX20201022-154421.png)

完美。

执行一个耗时操作，可以看到 docker 会临时创建一个容器，接下来当然就是根据路径映射设置相应的参数啦，程序执行即删除临时容器。
