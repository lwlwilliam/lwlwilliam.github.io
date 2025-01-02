---
title: Python 的 bytecode
layout: post
categories: [Python]
keywords: Python,bytecode,字节码
---

喜欢上了通过字节码来分析代码差异的感觉，前几天机缘巧合之下玩了下`PHP`的`opcode`，今天来看看`Python`的`bytecode`。今天也是巧合，恰好群里有人问`Python`中`3 > 2 == 2`为什么结果是`True`？很多语言其实并没有这种表达式。如果用过`JavaScript`，就会发现它的结果跟`Python`不一样，正因为如此，我就对`3 > 3 == 2`在`Python`中的底层逻辑有点好奇，那就直接动手吧。

有人猜测`3 > 2 == 2`可能跟`3 > 2 and 2 == 2`是一样的，这就对比一下两段代码。跟编译型语言有疑问时就看看编译产生的汇编类似，要知道`Python`代码的逻辑，就得研究它的字节码。`dis`模块通过反汇编支持`CPython`的`bytecode`分析。

```python
# bc.py
import dis


def foo():
    return 3 > 2 == 2


def bar():
    return 3 > 2 and 2 == 2


dis.dis(foo)
print('-' * 100)
dis.dis(bar)
print('-' * 100)
print(foo(), bar())
```

```bash
$ python3 bc.py
  6           0 LOAD_CONST               1 (3)
              2 LOAD_CONST               2 (2)
              4 DUP_TOP
              6 ROT_THREE
              8 COMPARE_OP               4 (>)
             10 JUMP_IF_FALSE_OR_POP    18
             12 LOAD_CONST               2 (2)
             14 COMPARE_OP               2 (==)
             16 RETURN_VALUE
        >>   18 ROT_TWO
             20 POP_TOP
             22 RETURN_VALUE
----------------------------------------------------------------------------------------------------
 10           0 LOAD_CONST               1 (3)
              2 LOAD_CONST               2 (2)
              4 COMPARE_OP               4 (>)
              6 JUMP_IF_FALSE_OR_POP    14
              8 LOAD_CONST               2 (2)
             10 LOAD_CONST               2 (2)
             12 COMPARE_OP               2 (==)
        >>   14 RETURN_VALUE
----------------------------------------------------------------------------------------------------
True True
```

光看结果，`foo`和`bar`函数的结果都是`True`，有戏了，可能真的就逻辑一样。分隔线顶部就是`3 > 2 == 2`的字节码，现在就来分析一下。
