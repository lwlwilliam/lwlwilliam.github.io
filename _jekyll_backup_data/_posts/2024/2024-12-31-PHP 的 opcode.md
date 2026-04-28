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

`VLD`是第三方扩展，暂且不表。

### 通过 opcode 解决疑问

思考以下代码的输出结果：

```php
<?php

$arr = ['a', 'b', 'c'];
$arr2 = $arr;

foreach ($arr as &$item) {
    $item = 'x';
}

foreach ($arr2 as $item) {
    $item = 'y';
}

print_r($arr);
print_r($arr2);
```

不理解引用的话，可能会觉得很疑惑。我们来看看以上代码的`opcode`分析一下为什么结果会如下所示。

```
Array
(
    [0] => x
    [1] => x
    [2] => y
)
Array
(
    [0] => a
    [1] => b
    [2] => c
)
```

使用`opcache`或`phpdbg`输出`opcode`如下，其中使用空行将代码进行了分割便于分析。

```
0000 ASSIGN CV0($arr) array(...)
0001 ASSIGN CV1($arr2) CV0($arr)

0002 V5 = FE_RESET_RW CV0($arr) 0006
0003 FE_FETCH_RW V5 CV2($item) 0006
0004 ASSIGN CV2($item) string("x")
0005 JMP 0003
0006 FE_FREE V5

0007 V7 = FE_RESET_R CV1($arr2) 0011
0008 FE_FETCH_R V7 CV2($item) 0011
0009 ASSIGN CV2($item) string("y")
0010 JMP 0008
0011 FE_FREE V7

0012 INIT_FCALL 1 96 string("print_r")
0013 SEND_VAR CV0($arr) 1
0014 DO_ICALL
0015 INIT_FCALL 1 96 string("print_r")
0016 SEND_VAR CV1($arr2) 1
0017 DO_ICALL
0018 RETURN int(1)
```

其中第二和第三部分的`opcode`正是两段`foreach`代码，也就是`0002-0006`和`0007-0011`，主要差异如下：

1. 第一个`foreach`使用了`RE_RESET_RW`，对`$arr`和`$item`可读可写，第二个`foreach`使用了`RE_FETCH_R`，对`$arr2`和`$item`只读；
2. `$item`对应的标识符都是`CV2`，对相当地址的数据进行读写；

通过以上对比，应该可以得到结论，第一个`foreach`循环时，对`$item`的修改影响`$arr`，因此，循环结束后，`$arr`的值应为：

```
Array
(
    [0] => x
    [1] => x
    [2] => x
)
```

与此同时，`$item`仍然指向`$arr[2]`，第二个`foreach`循环时，对`$item`的修改并不会影响`$arr2`，但由于`$item`的指向，`$arr[2]`的值随着`$item`的改变而改变，最终跟最后一轮循环时的值一致，因此，`$arr`最终为：

```
Array
(
    [0] => x
    [1] => x
    [2] => y
)
```

`PHP`的`opcode`并没有详细的文档记录，也没有提供向后兼容性，不像`Java`那样经过精心设计，因此在内部有如“直接运行`opcode`”之类的`RFC`都遭到了一致否决，类似的讨论如 [https://externals.io/message/111965](https://externals.io/message/111965)，还可以在 [https://externals.io](https://externals.io) 查阅更多相关信息。可能关于`opcode`最权威的资料就在源码中，例如 [https://github.com/php/php-src/blob/PHP-8.4.2/Zend/zend_vm_opcodes.h](https://github.com/php/php-src/blob/PHP-8.4.2/Zend/zend_vm_opcodes.h)。或许 [https://github.com/phpinternalsbook/PHP-Internals-Book](https://github.com/phpinternalsbook/PHP-Internals-Book)、[https://github.com/tpunt/php-internals-docs](https://github.com/tpunt/php-internals-docs) 对了解也有一定帮助。