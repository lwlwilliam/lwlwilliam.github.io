---
title: 浅谈 FrankenPHP 对 PHP 的影响
layout: post
categories: [ PHP ]
keywords: PHP,FrankenPHP
---

今年`PHP`基金会宣布了一件事`30 years of PHP: FrankenPHP is now part of the PHP organisation`。那么`FrankenPHP`是什么？为何得到青睐？

### 示例

对官网的自定义示例进行了一点调整，毕竟那个有点正式框架的影子，刚开始也让我有点摸不着头脑。

```php
<?php
// index.php

ini_set('display_errors', 'on');
ignore_user_abort(true);

$handler = static function () {
    header('Content-Type: application/json;charset=utf-8');
    echo json_encode(['name' => 'william'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
};

$maxRequests = (int)($_SERVER['MAX_REQUESTS'] ?? 0);
for ($nbRequests = 0; !$maxRequests || $nbRequests < $maxRequests; ++$nbRequests) {
    $keepRunning = frankenphp_handle_request($handler);

    gc_collect_cycles();
    if (!$keepRunning) {
        break;
    }
}
```

观察以上代码，`FrankenPHP`常驻内存的原理很简单，先解释执行`worker`脚本，脚本的核心就是一个循环（视情况可以无限循环，如果不放心，处理指定次数即可退出启动新
`worker`进程），`FrankenPHP`通过`frankenphp_handle_request`同步阻塞接收`HTTP`请求，接收请求后调用`$handler`函数，`$handler`
函数就是实际的代码逻辑，在这之前的代码可以是核心功能如加载路由类、数据库类等等，后续每次请求-响应周期都不再需要加载核心类。看到到这里，
`FrankenPHP`的`worker`模式提升性能的原因显而易见，常规的`fpm`项目，每次请求-响应都需要重新解释（有`OpCache`
则可省略这一步）执行，申请内存，甚至动态加载文件频繁`IO`操作，在大量请求时，累计的差距就会非常大。

但由于大部分`fpm`下的生态发展多年，架构天生无共享短生命周期，很多开发者的代码都不一定会考虑内存常驻的情况，直接迁移到
`FrankenPHP`的`worker`模式可能会水土不服，甚至需要改动项目逻辑。因此最好开始不要用`worker`模式，`classic`模式即可直接适配。

如果要改造自己的项目，对`$handler`函数进行修改，判断`$_SERVER['REQUEST_URI']`作为路由调用对应的控制器，如此这般，就是一个简单的框架。

### 运行

`-l`参数是监听地址，`--worker`参数是作为`worker`模式脚本的文件，`--watch`用于热更新。

```bash
$ frankenphp-mac-arm64 php-server -l 0.0.0.0:9292 --worker=./index.php,20 --watch ./index.php
```

### 测试

对比`fpm`脚本，同样`20`个`worker`进程。测试是在资源受限的云服务器`docker`容器中，数据会比一般开发机稍差。

```php
<?php
// fpm.php

header('Content-Type: application/json;charset=utf-8');
echo json_encode(['name' => 'william'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
```

```bash
$ wrk http://localhost/fpm.php
Running 10s test @ http://localhost/fpm.php
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     3.57ms    4.03ms  78.87ms   94.31%
    Req/Sec     1.59k   382.27     2.58k    72.50%
  31700 requests in 10.00s, 6.95MB read
Requests/sec:   3168.86
Transfer/sec:    711.74KB

$ wrk http://localhost:9292/
Running 10s test @ http://localhost:9292/
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     1.52ms    2.23ms  31.96ms   92.20%
    Req/Sec     4.90k   528.36     6.20k    73.50%
  97580 requests in 10.00s, 16.84MB read
Requests/sec:   9757.60
Transfer/sec:      1.68MB
```

`FrankenPHP`的`worker`模式`RPS`达到`9757.60`，虽然只是一个简单的输出，跟`php-fpm`
相比，提升可谓非常大，这就是它得到青睐的最大原因。**需要注意的是：FrankenPHP 能大幅提升性能的前提是响应周期很短，如果服务端业务比较复杂，对性能的提升效果并没有想象中那么大，毕竟它的核心原理就是减少每次响应时的准备步骤，如果程序大部分时间都消耗在运行中，那么与其相比，节省的准备时间倒显得微乎其微。**有兴趣可以继续测试以下对比脚本，看看`FrankenPHP`的优势还剩多少。

```php
<?php
// fpm.php

header('Content-Type: application/json;charset=utf-8');
$ret = [];
for ($i = 0; $i < 10000; $i++) {
	$ret[] = ['index' => $i];
}
echo json_encode($ret, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
```

```php
<?php
// index.php

ini_set('display_errors', 'on');
ignore_user_abort(true);

$handler = static function () {
    header('Content-Type: application/json;charset=utf-8');
	$ret = [];
	for ($i = 0; $i < 10000; $i++) {
		$ret[] = ['index' => $i];
	}
    echo json_encode($ret, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
};

$maxRequests = (int)($_SERVER['MAX_REQUESTS'] ?? 0);
for ($nbRequests = 0; !$maxRequests || $nbRequests < $maxRequests; ++$nbRequests) {
    $keepRunning = frankenphp_handle_request($handler);

    gc_collect_cycles();
    if (!$keepRunning) {
        break;
    }
}
```