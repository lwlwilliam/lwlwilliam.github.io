---
title: error 类型 Error() 方法的无限递归
layout: post
categories: [Go]
keywords: 递归, Go, error
---

在 Go 语言中使用 error 值来表示错误状态。事实上，error 类型是内置的接口，定义如下：

```go
type error interface {
	Error() string
}
```

函数一般会返回一个 error 类型的值，因此调用函数时应该通过测试 error 是否等于 nil 来处理错误，如：

```go
i, err := strconv.Atoi("42")
if err != nil {
	fmt.Printf("Could'n convert number: %v.\n", err)
	return
}

fmt.Println("Converted integer:", i)
```

如果 error 为 nil 说明调用成功，否则调用失败。

在编程过程中，常常需要自定义错误：

```go
type ErrNegativeSqrt float64

func (e ErrNegativeSqrt) Error() string
```

假如在 Error 方法中调用了 fmt.Sprint(e) 及其它类似调用，会导致死循环，这是为什么呢？以下通过一个完整示例来说明：

```go
package main

import (
	"fmt"
)

type ErrNegativeSqrt float64

func (e ErrNegativeSqrt) Error() string {
	// 死循环
	//return fmt.Sprintf("Could'n convert number: %v.\n", e)
	
	return fmt.Sprintf("Could'n convert number: %v.\n", float64(e))
}

func Sqrt(x float64) (float64, error) {
	if x >= 0 {
        return 0, nil
	} else {
		return 0, ErrNegativeSqrt(x)
	}
}

func main() {
	fmt.Println(Sqrt(2))
	fmt.Println(Sqrt(-2))
}
```

现在来看 Error() 方法体，两个 fmt.Sprintf() 调用的区别就在于是否对 e 进行了类型转换，没有进行类型转换的会导致死循环。这是由于没有进行转换时，fmt.Sprintf() 使用
e 参数时会调用 e.Error()，e.Error() 调用时又会导致 e.Error() 被递归调用，无限递归下去，于是就产生了死循环。对其进行类型转换则避免了 e.Error() 的递归调用。
