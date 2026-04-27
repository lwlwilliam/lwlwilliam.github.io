---
title: 在 PHP 中模拟 Go 语言的 defer 语句
layout: post
categories: [PHP]
keywords: PHP,Go,defer
---

看到一个很有意思的项目 <a href="https://github.com/php-defer/php-defer" target="_blank">https://github.com/php-defer/php-defer</a>，这个项目只用了`10`行左右的代码就实现了`Go`语言中的`defer`，看来灵活运用数据结构还是很重要的。项目源码如下：

```php
<?php

function defer(?SplStack &$context, callable $callback): void {
    $context ??= new class extends SplStack {
        public function __destruct() {
            while ($this->count() > 0) {
                call_user_func($this->pop());
            }
        }
    };

    $context->push($callback);
}
```

略显抽象，怎么来理解它呢？`$context`实际上就是一个栈变量，通过`&`达到作用域内共用一个栈的效果，作用域内所有`defer`的回调函数都放到`$context`栈中。

关键点在于`new class extends SplStack`一个匿名类继承并改写了`SplStack`类的`__destruct()`，使得`$context`销毁时可以逆序调用入栈的回调函数，用法如下。

```php
<?php

function foo(): void {
    defer($_, function () {
        echo "first defer\n";
    });
    defer($_, function () {
        echo "second defer\n";
    });

    echo "before exception\n";
    throw new Exception('My exception');
}

try {
    foo();
} catch (Exception $e) {
    echo $e->getMessage(), "\n";
}
```

相当于下面的`Go`代码。

```go
package main

import "fmt"

func foo() {
    defer fmt.Println("first defer")
    defer fmt.Println("second defer")

    fmt.Println("before exception")
    panic("My exception")
}

func main() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println(r)
        }
    }()
    foo()
}
```

调用结果如下。

```bash
$ php defer.php
before exception
second defer
first defer
My exception
```

跟我们设想的一样，`defer`回调函数确实是逆序输出的，跟`Go`语言的效果一致，可以再看看`return`的。

```php
<?php

function foo(): string {
    defer($_, function () {
        echo "first defer\n";
    });
    defer($_, function () {
        echo "second defer\n";
    });

    return "foo";
}

echo foo(), "\n";
```

对应以下`Go`代码。

```go
package main

import "fmt"

func foo() string {
    defer fmt.Println("first defer")
    defer fmt.Println("second defer")

    return "foo"
}

func main() {
    fmt.Println(foo())
}
```

输出如下：

```bash
$ php defer.php
second defer
first defer
foo
```

无论是异常还是返回，该`defer`函数的行为都跟`Go`语言的`defer`语句一致。

小小改造一下它，让它可以接收参数。

```php
<?php

function defer(?SplStack &$context, callable $callback, ...$args): void {
    $context ??= new class extends SplStack {
        public function __destruct() {
            while ($this->count() > 0) {
                $item = $this->pop();
                $func = array_shift($item);
                if (empty($item)) {
                    call_user_func($func);
                } else {
                    call_user_func($func, ...$item);
                }
            }
        }
    };

    $context->push([$callback, ...$args]);
}
```

变化之处就在增加不限数量的参数`...$args`，入栈时，以数组形式入栈，弹栈时，先获取数据的第一个元素，调用函数分为带参数和不带参数的区别，用法跟先前几乎一样。

```php
<?php

defer($_, function ($item) {
    printf("item: %s\n", $item);
}, "first");

defer($_, function ($item) {
    printf("item: %s\n", $item);
}, "second");
```