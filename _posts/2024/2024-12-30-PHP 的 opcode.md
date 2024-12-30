---
title: PHP 的 opcode
layout: post
categories: [PHP]
keywords: php,PHP,opcode
---

`opcode`跟`PHP`，类似于`bytecode`跟`Java`的关系，相当于`机器码`和编译型语言的关系。

`PHP`是一门解释型语言，它的执行单元就是`opcode`，`Zend Engine`就是执行`opcode`的地方，`Zend Engine`也就是常说的`VM`。`JVM`比较出名，它就是针对`Java`设计的`VM`，这样说应该理解了`PHP`的`Zend Engine`和`opcode`是什么东西了吧。

看看如下代码：

```php
<?php
// opcode1.php

echo "Hello world";
```

以上代码的`opcode`是这样的：

```
0000 ECHO string("Hello world")
0001 RETURN int(1)
```

如果多个输出呢？

```php
<?php
// opcode2.php

echo "Hello world";
echo "Hello world";
echo "Hello world";
```

这个问题先暂且不管。

有多种方法可以查看`opcode`，如`Zend Opcache(opcache)`扩展、`phpdbg`接口以及`Vulcan Login Dumper(VLD)`扩展。

### 使用 Zend Opcache

前提要求：`Zend Opcache`扩展必须安装并启用。

`opcache.opt_debug_level`接收一个十六进制值用于配置`opcode`的输出，设置为`0`时会禁用输出。

* `opcache.opt_debug_level=0x10000`：输出未优化的`opcode`；
* `opcache.opt_debug_level=0x20000`：输出优化后的`opcode`；
* `opcache.opt_debug_level=0x40000`：以上下文无关方法形式输出`opcode`；
* `opcache.opt_debug_level=0x200000`：以`Static Single Assignments`形式输出`opcode`；

再次以上述的`opcode2.php`为例。

```bash
$ php -d opcache.enable=On -d opcache.enable_cli=On -d opcache.opt_debug_level=0x10000 opcode2.php

$_main:
     ; (lines=4, args=0, vars=0, tmps=0)
     ; (before optimizer)
     ; /root/opcode.php:1-6
     ; return  [] RANGE[0..0]
0000 ECHO string("Hello world")
0001 ECHO string("Hello world")
0002 ECHO string("Hello world")
0003 RETURN int(1)
$ php -d opcache.enable=On -d opcache.enable_cli=On -d opcache.opt_debug_level=0x20000 opcode2.php

$_main:
     ; (lines=2, args=0, vars=0, tmps=0)
     ; (after optimizer)
     ; /root/opcode.php:1-6
0000 ECHO string("Hello worldHello worldHello world")
0001 RETURN int(1)
```

这就是对“如果多个输出呢？”这个问题的回答，未经优化时，三个`echo`语句解析为三条`ECHO string("Hello world)`指令，优化后合并为一条指令。

### 使用 phpdbg

```bash
$ phpdbg -p opcode2.php

$_main:
     ; (lines=4, args=0, vars=0, tmps=0)
     ; /root/opcode.php:1-6
L0003 0000 ECHO string("Hello world")
L0004 0001 ECHO string("Hello world")
L0005 0002 ECHO string("Hello world")
L0006 0003 RETURN int(1)
[Script ended normally]
```

