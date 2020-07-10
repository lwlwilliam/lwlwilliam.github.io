---
title: master-worker 守护多进程模式
layout: post
categories: [操作系统, PHP]
keywords: 守护进程, master-worker 模式
---



```php
<?php

declare(ticks=1);

class Worker {
    public static $count = 10;

    public static $children = [];

    public static function runAll() {
        static::runMaster();
        static::monitor();
    }

    private static function runMaster() {
        // 确保进程有最大操作权限
        umask(0);

        $pid = pcntl_fork();
        if ($pid > 0) {
            exit;
        } else {
            if ($pid < 0) {
                throw new Exception('fork master failed');
            }
        }

        // 守护进程关键，脱离终端
        if (posix_setsid() === -1) {
            throw new Exception('master setsid failed');
        }

        // 具体原因看"守护进程"一文
        $pid = pcntl_fork();
        if ($pid > 0) {
            exit;
        } else {
            if ($pid < 0) {
                throw new Exception('fork master failed');
            }
        }

        pcntl_signal(SIGTERM, 'static::sig_handler');
        cli_set_process_title('master process');

        // worker 进程
        for ($i = 0; $i < static::$count; $i++) {
            static::runWorker();
        }
    }

    private static function sig_handler($signo) {
        foreach (static::$children as $child) {
            posix_kill($child, SIGKILL);
        }

        echo "exit\n";
        exit;
    }

    private static function runWorker() {
        umask(0);

        $pid = pcntl_fork();
        if ($pid > 0) {
            echo "\nworker $pid is running.\n";
            static::$children[$pid] = $pid;
        } else {
            if ($pid == 0) {
                static::$children[getmypid()] = getmypid();
                if (posix_setsid() === -1) {
                    throw new Exception('worker setsid failed');
                }

                cli_set_process_title('worker process');

                echo "Hello world: " . getmypid() . "\n";
                sleep(20);
                unset(static::$children[getmypid()]);

                exit;
            } else {
                throw new Exception('fork worker process failed');
            }
        }
    }

    // 监控 worker，如果有进程退出，则重新 fork 一个 worker 进程
    private static function monitor() {
        while ($pid = pcntl_wait($status)) {
            if ($pid == -1 || $pid == $status) {
                unset(static::$children[$pid]);
                break;
            } else {
                static::runWorker();
            }
        }
    }
}

Worker::runAll();
```