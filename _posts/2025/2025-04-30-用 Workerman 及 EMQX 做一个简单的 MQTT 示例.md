---
title: 用 Workerman 及 EMQX 做一个简单的 MQTT 示例
layout: post
categories: [计算机网络]
keywords: 计算机网络
---

```bash
$ docker run -d --name emqx -e EMQX_DASHBOARD__DEFAULT_PASSWORD=admin --network=lnmp -ti -p 18083:18083 -p 1883:1883 -p 8083-8084:8083-8084 -p 4370:4370 -p 5369:5369 emqx/emqx:5.8
```

```bash
$ composer require workerman/mqtt:2.1
```

```php
<?php

use Workerman\Timer;
use Workerman\Worker;

require_once __DIR__ . '/vendor/autoload.php';

$worker = new Worker();
$worker->onWorkerStart = function () {
    $mqttClients = [];
    for ($i = 0; $i < 10000; $i++) {
        $mqttClients[$i] = new Workerman\Mqtt\Client('mqtt://emqx:1883');
        $mqttClients[$i]->onConnect = function ($mqttClient) {
            $mqttClient->subscribe('test');
        };
        $mqttClients[$i]->onMessage = function ($topic, $content) use ($i) {
            echo $i, "\t", $topic, "\t", $content, "\n";
        };
        $mqttClients[$i]->connect();
    }

    $num = 1;
    Timer::add(1, function () use ($mqttClients, &$num) {
        try {
            $mqttClients[0]->publish('test', 'hello ' . $num);
            $num += 1;
        } catch (Throwable $e) {
            echo "Throwable:", $e->getMessage(), "\n";
        }
    });
};

try {
    Worker::runAll();
} catch (Throwable $e) {
    echo $e->getMessage(), "\n";
}
```

![dashboard](/assets/images/2025/0430/dashboard.png)

![subscribe_from_dashboard](/assets/images/2025/0430/subscribe_from_dashboard.png)