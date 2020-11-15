---
title: Docker 搭建 LNMP 环境
layout: post
categories: [工具]
keywords: Docker, LNMP
---

### 下载镜像

```bash
$ docker pull nginx
$ docker pull mysql:5.7
$ docker pull php:7.1-fpm
```

### 启动容器&配置&测试

##### MySQL

1.	启动容器，注意要添加 MYSQL_ROOT_PASSWORD 环境变量，用来设置 root 密码

    ```bash
    $ docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password mysql:5.7
    ```

2.	创建测试 mysql 数据

    ```bash
    $ docker exec -ti mysql /bin/bash
    # mysql -h host -u username -p
    mysql> USE mysql;
    mysql> GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'root' WITH GRANT OPTION;
    mysql> FLUSH PRIVILEGES;
    mysql> CREATE DATABASE test;
    mysql> USE test;
    mysql> CREATE TABLE a (
    mysql> id INT(11) NOT NULL AUTO_INCREMENT COMMENT '自增 ID',
    mysql> name VARCHAR(32) NOT NULL DEFAULT '' COMMENT '名称',
    mysql> PRIMARY KEY (id)
    mysql> ) ENGINE=InnoDB CHARSET=utf8;

    mysql> INSERT INTO a 
    mysql> (name) VALUES 
    mysql> ('aaa'),
    mysql> ('bbb');
    ```

##### PHP

1.	准备测试 php 文件

    ```php
    <?php
        # /workingDirectory/index.php

        # 将 new mysqli() 中的 host, username, password, dbname 改成对应的值
        # 这里的 host 填写启动容器中的 --link mysql:mysql 配置的网络名称，此处为 mysql
        $db = new mysqli("mysql", "username", "password", "dbname");
        $res = $db->query("select * from a");
        while ($row = $res->fetch_assoc()) {
            print_r($row);
        }
    ```

2.	启动容器，安装 mysqli 扩展，将 php 文件复制到容器对应目录中，有以下两种方法，推荐使用第二种，直接挂载数据卷

    1.  没有数据卷挂载 

        ```bash
        $ docker run -d --name php -p 9000:9000 --link mysql:mysql php:7.1-fpm
        $ docker exec php docker-php-ext-install mysqli
        $ docker restart php
        $ docker exec php mkdir /usr/share/php # 根据自己的实际创建，DOCUMENT_ROOT
        $ docker cp /workingDirectory/index.php php:/usr/share/php/index.php
        ```
        
    2.  数据卷挂载，使用`-v`参数将`/var/www/html`目录挂载到容器的`/usr/share/php`中，注意，使用数据卷要加上`privileged=true`，否则很可能会提示没有权限
    
        ```bash
        $ docker run -d --name php -p 9000:9000 --link mysql:mysql -v /var/www/html:/usr/share/php --privileged=true php:7.1-fpm 
        $ docker exec php docker-php-ext-install mysqli
        $ docker restart php
        $ cp /workingDirectory/index.php /var/www/html/index.php
        ```

##### Nginx

1.	启动容器，在容器内的`/etc/nginx/conf.d/default.conf`文件中`server`模块内添加如下`location{}`配置，`fastcgi_pass`中的`php`是`--link php:php`启动参数中的连接名称

    ```bash
    $ docker run -d --name nginx -p 9999:80 --link php:php nginx
    $ docker cp nginx:/etc/nginx/conf.d/default.conf default.conf
    $ vim default.conf
    location ~ \.php$ {
        root            /usr/share/php; # $document_root
        fastcgi_pass	php:9000; # php 指的是 --link php:php 参数指定的网络名称
        fastcgi_index	index.php;
        fastcgi_param	SCRIPT_FILENAME	$document_root$fastcgi_script_name;
        include         fastcgi_params;
    }
    $ docker cp default.conf nginx:/etc/nginx/conf.d/default.conf
    $ docker restart nginx
    ```

##### 测试

至此，基本的环境已经搭建好了。现在测试一下环境能否正常工作。nginx 容器启动时`-p 9999:80`参数指定了宿主机通过`9999`端口访问服务器。可以看到在访问`index.php`时，nginx 正确转发到 php-fpm 中了，mysqli 扩展也能正常工作。docker 下的 LNMP 环境已经搭建完成。

![default](/assets/images/2020/0329/WX_20200329154835.png)

![default](/assets/images/2020/0329/WX_20200329155032.png)
