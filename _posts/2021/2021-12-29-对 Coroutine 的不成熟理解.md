---
title: 对 Coroutine 的不成熟理解
layout: post
categories: [编译原理]
keywords: Coroutine
---

在需要恢复控制权的位置设置一系列 label：一个位于开始位置，另一个在每个 return 语句后面。我们还设置了一个 state 变量，用于在多次函数调用时告诉我们下次应该在哪里恢复控制权。在每次返回前，都需要更新 state 变量，使其指向正确的 label。而在调用后，我们都会通过 switch 对 state 进行判断，以便找到下一次要跳转的 label。

```c
#include <stdio.h>

int function(void) {
    static int i, state = 0;
    switch (state) {
        case 0: goto LABEL0;
        case 1: goto LABEL1;
    }

    LABEL0: /* start of function */
    for (i = 0; i < 10; i ++) {
        state = 1; /* so we will come back to LABEL1 */
        return i;
        LABEL1:; /* resume control straight after the return */
    }
}

int main() {
    printf("%d\n", function());
    printf("task 1\n");
    printf("%d\n", function());
    printf("task 2\n");
    printf("%d\n", function());
    printf("task 3\n");

    return 0;
}
```

但是，上面的代码是丑陋的。其实最糟糕的部分就是需要手动维护一组 label，并且必须放在函数体之间且需要 switch 语句。我们每添加一个 return 说一句，都必须创建一个新的 label 并将其添加到 switch 中；每移除一个 return 语句，都必须移除其对应的 label。这额外增加了我们两倍的工作量。

```c
#include <stdio.h>

int function(void) {
	static int i, state = 0;

	switch (state) {
		case 0: /* start of function */
			for (i = 0; i < 10; i ++) {
				state = 1;
				return i;
				case 1:; /* resume control straight after the return */
			}
	}
}

int main() {
	printf("%d\n", function());
	printf("task 1\n");
	printf("%d\n", function());
	printf("task 2\n");
	printf("%d\n", function());
	printf("task 3\n");

	return 0;
}
```

```c
#include <stdio.h>

#define crBegin static int state = 0; switch(state) { case 0:
#define crReturn(i, x) do { state = 1; return x; case 1:; } while (0)
#define crFinish }

int function(void) {
    static int i;
    crBegin;
    for (i = 0; i < 10; i ++) {
        crReturn(1, i);
    }
    crFinish;
}

int main() {
    printf("%d\n", function());
    printf("task: 1\n");
    printf("%d\n", function());
    printf("task: 2\n");
    printf("%d\n", function());
    printf("task: 3\n");
    
    return 0;
}
```

### 参考

[Coroutines in C](https://www.chiark.greenend.org.uk/~sgtatham/coroutines.html)