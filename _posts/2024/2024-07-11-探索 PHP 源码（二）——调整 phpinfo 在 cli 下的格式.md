---
title: 探索 PHP 源码（二）——调整 phpinfo 在 cli 下的格式
layout: post
categories: [PHP8.2.6-源码探索]
keywords: PHP,编译原理
---

`php-cli`下的`phpinfo()`并没有`html`格式，对于像`reactphp`、`amphp`等库就显示不是那么友好了，所以添加一个选项来开关`html`格式的`phpinfo()`显示比较有用。

`sapi/cli/php_cli.c`的代码：

```cpp
int phpinfo_as_text = 1;

while ((c = php_getopt(argc, argv, OPTIONS, &php_optarg, &php_optind, 1, 2))!=-1) {
    switch (c) {
        ...
        case 'e': /* enable extended info output */
            phpinfo_as_text = 0;
            use_extended_info = 1;
            break;
    }
}

...
sapi_module->phpinfo_as_text = phpinfo_as_text;
```

定位一下`sapi_module->phpinfo_as_text`这部分代码，即可找到以上代码修改位置，利用一下现有的选项`-e`。接下来就可以`php -e xxx.php`来开启命令行下的`html`格式信息。

如果不想复用其它选项，则麻烦一点，在`const opt_struct OPTIONS[] = {}`中自己加个选项，如`{'k', 0, "phpinfo-as-text"}`，再将以上`case 'e'`中的`phpinfo_as_text = 0`放到新增的`case 'k'`中。

使用`reactphp`测试一下：

```php
<?php
// react.php

require __DIR__ . '/vendor/autoload.php';

$http = new React\Http\HttpServer(function (Psr\Http\Message\ServerRequestInterface $request) {
    ob_start();
    phpinfo();
    $info = ob_get_contents();
    ob_end_clean();
    return React\Http\Message\Response::html(
        $info
    );
});

$socket = new React\Socket\SocketServer('127.0.0.1:8080');
$http->listen($socket);
```

分别用以下命令测试（`php`需要更换为自己编译的版本）：

```bash
$ php react.php
$ php -e react.php
```

效果如图所示：

![cli_raw](/assets/images/2024/0711/cli_raw.png)
![cli_html](/assets/images/2024/0711/cli_html.png)
