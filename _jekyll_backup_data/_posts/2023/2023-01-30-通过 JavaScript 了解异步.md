---
title: 通过 JavaScript 了解异步
layout: post
categories: [计算机原理]
keywords: 异步,async
---

本文整理自[MDN](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Asynchronous)。

同步程序按照书写代码的顺序执行程序，假如其中一段代码耗时特别长，后续代码就一直无法执行。我们需要一种方法解决以上问题：

1. 通过调用一个函数来启动一个长期运行的操作；
2. 让函数开始操作并立即返回，这样我们的程序就可以保持对其他事件做出反应的能力；
3. 当操作最终完成时，通知我们操作的结果；

以上能力就是异步为我们提供的能力。

### 事件处理程序

JavaScript 中的事件处理程序实际上就是异步编程的一种方式：你提供的函数（事件处理程序）将在事件发生时被调用（而不是立即被调用）。如果"事件"是"异步操作已经完成"，那么你就可以看到事件如何被用来通知调用者异步函数调用的结果。

一些早期的异步 API 正是以这种方式来使用事件的。例如 XMLHttpRequest API 强以让你用 JavaScript 向远程服务器发起 HTTP 请求。

```javascript
const xhr = new XMLHttpRequest()
xhr.timeout = 3000
xhr.ontimeout = function (ev) { 
    console.log(ev)
}
xhr.open('GET', 'https://www.google.com')
xhr.send()

console.log('last line')
```

以上代码会先输出"last line"，再输出超时事件对象。

### 回调

事件处理程序是一种特殊类型的回调函数。而回调函数则是一个被传递到另一个函数中的会在适当时候被调用的函数。回调函数曾经是 JavaScript 中实现异步函数的主要方式。

由于"回调地狱"的问题，以及处理错误的困难，大多数现代异步 API 都不使用回调。事实上，JavaScript 中异步编程的基础是 Promise。

### Promise

Promise 是现代 JavaScript 中异步编程的基础，是一个由异步函数返回的可以向我们指示当前操作所处的状态的对象。在 Promise 返回给调用者的时候，操作往往还没有完成，但 Promise 对象可以让我们操作最终完成时对其进行处理（无论成功还是失败）。

在基于 Promise 的 API 中，异步函数会启动操作并返回 Promise 对象。然后可以将处理函数附加到 Promise 对象上，当操作完成时（成功或失败），这些处理函数将被执行。

fetch() API 就是一个现代的、基于 Promise 的、用于替代 XMLHttpRequest 的方法。我们可以从中一窥 Promise 的用法。

```javascript
const fetchPromise = fetch('http://localhost')

fetchPromise.then(res => {
    console.log(res)
})

console.log('已发送')
```

"已发送"的消息在收到响应之前就被输出。这看起来跟 XMLHttpRequest 差不多，似乎只是将事件处理程序传给 then() 方法中罢了。

Promise 使用不当时同样会出现"回调地狱"。

```javascript
const fetchPromise = fetch('http://localhost')

fetchPromise.then(res => {
    const textPromise = res.text()
    textPromise.then(text => {
        console.log(text)
    })
})

console.log('已发送')
```

但 Promise 的优雅之处在于 then() 方法会返回 Promise 对象，这样一来就可以链式使用 Promise。如上代码 then() 方法中的 res.url 可以通过返回的 Promise 对象传给下一个 then() 方法：

```javascript
const fetchPromise = fetch('http://localhost')

fetchPromise.then(res => {
    return res.text()
}).then(text => {
    console.log(text)
})

console.log('已发送')
```

Promise 还提供了一个 catch() 方法来处理错误。

```javascript
const fetchPromise = fetch('http://localhost')

fetchPromise.then(res => {
    if (res.status !== 200) {
        throw new Error(`请求错误(${res.statusText})`)
    }

    return res.text()
}).then(text => {
    console.log(text)
}).catch(e => {
    console.log(e.stack.replaceAll('\n', ''))
})

console.log('已发送')
```

### async 和 await

在一个函数的开头添加 async，就可以使其成为异步函数。在异步函数中，可以在调用一个 Promise 的函数之前使用 await 关键字。这使得代码在该点上等待，直到 Promise 被完成，这时 Promise 的响应被当作返回值，或者被拒绝的响应被作为错误抛出。

这样就能编写像同步代码一样的异步函数。

```javascript
async function fetchLocalhost() {
    try {
        const res = await fetch('http://localhost')
        console.log(res.status)

        console.log('已发送')
    } catch (e) {
        console.log(e.stack.replaceAll('\n', ''))
    }
}

const fetchPromise = fetchLocalhost()
console.log(fetchPromise)
```

需要注意的是异步函数返回的总是 Promise 对象。
