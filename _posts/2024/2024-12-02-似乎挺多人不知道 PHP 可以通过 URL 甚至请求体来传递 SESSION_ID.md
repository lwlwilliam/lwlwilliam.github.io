---
title: 似乎挺多人不知道 PHP 可以通过 URL 甚至请求体来传递 SESSION_ID
layout: post
categories: [计算机网络]
keywords: session,cookie,url,php,http
---

由于`HTTP`是无状态的，服务端不知道前一个访问者跟后一个访问者是否为同一人，于是会话机制出现了。`session`和`cookie`几乎总是同时出现的。`cookie`是由服务端创建、由客户端保存的小块数据，在用户再次访问服务时，会带上该服务端对应的`cookie`，服务端比对后就能辨别出用户身份。而在服务端跟`cookie`对应的数据就称为`session`。

从以上描述可以发现，会话中的`cookie`是由服务端生成的，且要唯一识别用户，可称为`session_id`，`PHP`默认通过`cookie`传递`session_id`。`HTTP`协议中有个响应头为`Set-Cookie`就是用来干这话的，`HTTP`响应报文无非就响应头和响应体，不用`Set-Cookie`行不行？当然，自己实现一套`session`机制也是可以的；既然服务端可以通过其它响应头或响应体来传递`session_id`，那客户端是不是也能不通过`Cookie`请求头来传递`session_id`？确实也是可以的。

### 通过 URL 传递

`PHP`的`session`机制除了通过`cookie`来传递`session_id`外，还可以通过`URL`传参来传递，具体可看[https://www.php.net/manual/en/session.idpassing.php](https://www.php.net/manual/en/session.idpassing.php)一节。但需要修改一下`php.ini`配置，测试代码如下：

```php
<?php

ini_set('session.use_only_cookies', 0);
ini_set('session.name', 'phpsid');

session_start();

if (isset($_GET['init'])) {
    $_SESSION['name'] = 'lwlinux';
    echo session_id(), PHP_EOL;
}

print_r($_SESSION);
```

由于`PHP`出于安全的考虑，默认只能允许通过`cookie`传递`session_id`，为了测试，需要将`session.use_cookies`和`session.use_only_cookies`禁用，同时设置一个易记的`session.name`。以下命令完整地测试了创建`session`、默认无参数无法获取`session`、`URL`传参获取`session`的步骤。这个`session_id`在客户端怎么保存就不需要多说了吧？

```bash
$ curl http://php84.id/programming_practice/php/snippets/php.php?init
73c6fa808fc7e2074a3c68e40b412f3d
Array
(
    [name] => lwlinux
)
$ curl http://php84.id/programming_practice/php/snippets/php.php
Array
(
)
$ curl http://php84.id/programming_practice/php/snippets/php.php?phpsid=73c6fa808fc7e2074a3c68e40b412f3d
Array
(
    [name] => lwlinux
)
```

### 通过请求体传递

当然通过`URL`传递确实不安全了，不过在客户端禁用`cookie`时也没办法，可以使用`https`等方式来加强安全，只不过`URL`暴露的风险还是大。其实，`PHP`还可以通过请求参数来传递，起码不存在`URL`泄露的风险。对比上述`PHP`代码，只是添加了获取`phpsid`请求体参数，通过`session_id`设置当前会话`ID`的逻辑。

```php
<?php

ini_set('session.use_only_cookies', 0);
ini_set('session.name', 'phpsid');

session_start();

if (isset($_GET['init'])) {
    $_SESSION['name'] = 'lwlinux';
    echo session_id(), PHP_EOL;
}

if (!empty($_POST['phpsid'])) {
    session_id($_POST['phpsid']);
}

print_r($_SESSION);
```

沿用上面生成的`session_id`，对比测试一下是否带参数即可。

```bash
$ curl http://php84.id/programming_practice/php/snippets/php.php
Array
(
)
$ curl -d 'phpsid=73c6fa808fc7e2074a3c68e40b412f3d' http://php84.id/programming_practice/php/snippets/php.php
Array
(
    [name] => lwlinux
)
```
