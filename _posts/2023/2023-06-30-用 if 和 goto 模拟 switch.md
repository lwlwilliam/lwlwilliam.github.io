---
title: 用 if 和 goto 模拟 switch
layout: post
categories: [PHP]
keywords: PHP,if,else,goto,switch,flow-control,流程控制
---

很多编程语言都会有`switch`语句。`switch`作为选择语句的一种，也是可以用`if-else`语句来表示的。在实现了`switch`的大部分编程语言中，通常跟`break`跳转语句配合来进行控制，其一般语法如下：

```
switch (expression) {
    case constant1:
        statements1;
        break;
    case constant2:
        statements2;
        break;
    .
    .
    .
    default:
        defaultStatements;
}
```

`switch`语句的执行过程：首先计算`expression`的值，接着跟`constant1`进行比较，如果相等，则执行`statements1`直至遇到`break`语句，当遇到`break`语句时，也就意味着`switch`语句结束；如果没有遇到`break`语句，则会一直往下执行`statements2`...`defaultStatements`直至`switch`结束。

如果`expression`的值不等于`constant1`，则跟`constant2`进行比较，后续跟以上过程一样。

最后，如果`expression`的值跟所有的`constant`都不相等，如果存在`default`标签，程序就会执行`default`标签后的`defaultStatements`；否则结束。

以下是`php`的`switch`示例：

```php
<?php

$expression = 'a';
switch ($expression) {
    case 'a':
        echo "expression == 'a'\n";
        break;
    case 'b':
        echo "expression == 'b'\n";
        break;
    case 'c':
        echo "expression == 'c'\n";
        break;
    default:
        echo "expression do not match any cases\n";
}
```

`break`语句的作用是什么？跳转到`switch`语句的结束位置，我们可以用`goto`来模拟；至于`case 'a'`...`default`这些，看起来有点熟悉啊，这不就跟`goto`语句的标签参数一样吗？行动起来，改写吧。

为了让`goto`语句可以结束掉`switch`语句，我们得先给`switch`语句搞两个标签：`SWITCH_BEGIN`和`SWITCH_END`。至于`case 'a'`等等，就用`CASE_A_BEGIN`和`CASE_A_END`等对应的一组标签代替，`default`用`DEFAULT_LABEL`代替。

```php
<?php

$expression = 'a';
SWITCH_BEGIN:
CASE_A_BEGIN:
    goto SWITCH_END;
CASE_A_END:
CASE_B_BEGIN:
    goto SWITCH_END;
CASE_B_END:
CASE_C_BEGIN:
    goto SWITCH_END;
CASE_C_END:
DEFAULT_LABEL:
SWITCH_END:
```

现在看起来是不是像模像样了？条件比较在哪里？别着急，马上安排。

```php
<?php

$expression = 'a';
SWITCH_BEGIN:
CASE_A_BEGIN:
    if ($expression == 'a') {
        echo "expression == 'a'\n";
    }
    goto SWITCH_END;
CASE_A_END:
CASE_B_BEGIN:
    if ($expression == 'b') {
        echo "expression == 'b'\n";
    }
    goto SWITCH_END;
CASE_B_END:
CASE_C_BEGIN:
    if ($expression == 'c') {
        echo "expression == 'c'\n";
    }
    goto SWITCH_END;
CASE_C_END:
DEFAULT_LABEL:
    echo "expression do not match any constant\n";
SWITCH_END:
```

现在每个标签都加了`if`用于判断`expression`和`constant`的值是否相等。这样就行了吧？不对，我们还忘了`switch`语句很重要的特性，就是`expression`和`constant`如果相等，并且没有遇到`break`语句，就会一直执行剩余部分。也就是说，假如`CASE_A`中，`if ($expression == 'a')`为`true`，而且没有`goto`语句的话，`CASE_B`中的语句也要被执行，这里还要先对`if ($expression == 'b')`判断，显然是不对的。因此，我们需要一种可以绕过该判断的机制。

如果绕过该机制，则说明前面有`CASE`标签中的语句已经被执行过（也就是说进入过其它标签），我们可以用一个标记来记录进入`CASE`标签的状态，接下来加个`$open`标记，顺便将条件判断修改一下，让它看起来跟`switch`尽可能相似。

```php
<?php

$expression = 'a';

SWITCH_BEGIN:
    $open = false;
CASE_A_BEGIN:
    if ($expression != 'a' && !$open) { goto CASE_A_END; } else { $open = true; }

    echo "expression == 'a'\n";
    goto SWITCH_END; // break;
CASE_A_END:
CASE_B_BEGIN:
    if ($expression != 'b' && !$open) { goto CASE_B_END; } else { $open = true; }

    echo "expression == 'b'\n";
    goto SWITCH_END; // break;
CASE_B_END:
CASE_C_BEGIN:
    if ($expression != 'c' && !$open) { goto CASE_C_END; } else { $open = true; }

    echo "expression == 'c'\n";
    goto SWITCH_END; // break;
CASE_C_END:
DEFAULT_LABEL:
    echo "expression do not match any constant\n";
SWITCH_END:
```

至此，模拟代码已经完整。

嗯嗯，看起来就很麻烦，而且如果实际应用于项目上，还得考虑标签唯一性，`$open`也得特供，还是用`switch`语句吧，本文仅用于辅助理解`switch`的控制逻辑。

可能`switch`的逻辑对初学者不太好理解，而且通常情况下都要加`break`来中断语句，所以`Go`语言直接将`break`给省略了，如果要继续执行后面标签中的语句，需要额外加`fallthrough`。

哈哈哈，不知道为啥，我从这简单的模拟代码中看到了编译原理的影子，学久了看啥都觉得像它。