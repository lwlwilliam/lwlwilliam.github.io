---
title: Master-Worker 守护多进程模式
layout: post
categories: [操作系统, PHP]
keywords: 守护进程, Master-Worker 模式
---

Master-Worker 模式的核心思想是 Master 进程和 Worker 进程各自分担各自的任务，协同完成信息处理的模式。

Master 进程用于管理维护 Worker 进程，而 Worker 进程则用于处理业务，如维持各自的客户端连接。

以下是用 PHP 实现的简单的 Master-Worker 守护多进程模式。

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

    /**
     * 主进程转为守护进程，这里的要点是 fork 两次，并且设置会话 id。一般情况下 fork 一次就够了，System-V 系统需要特殊处理
     */
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

    /*
     * 创建 Worker 进程
     */
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