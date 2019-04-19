---
title: 使用 socket 理解 HTTP
layout: default
categories: [计算机网络]
---

# 使用 socket 理解 HTTP

随着基于 web 的软件（web 应用、微服务、REST、SOAP 等）的日益流行，思考其背后的原理总是好的。当我冒险进入 Flask 或者 Django 这样的框架时
这对我特别有用。

那么我们对其深入了解到什么程度呢？协议栈中最主要的传输协议 TCP 和 UDP。

### TCP 和 UDP

这里就不详细介绍了，TCP 和 UDP 是在网络中传输字节的两个主要标准。它们在连接上有着本质的区别，TCP 要求握手（在服务端与客户端进程间的一个正式连接）
，而客户端发送 UDP 消息到服务端时则不保证传输的完整性。

在本文，我们将重点讨论 TCP，因为对于使用 HTTP 的网络流量，几乎总是使用 TCP（因此网络协议栈的典型标签是 TCP/IP）。

那么我们如何 TCP 在网络上的两个进程之间传输消息呢？答案之一是 socket。

### Socket

Socket 是程序与操作系统之间魔术般的接口。socket API 由操作系统提供，所有编译语言都可以通过库来访问，因此开发者可以选择任何一种，只要是 Python 
的就可以了（译注：因为本文使用 Python）。

下面让我们来创建使用 TCP socket 来通信的服务端和客户端脚本（以下脚本都不兼容 Python3）。


```python
# server_tcp.py
import socket

# socket.SOCK_STREAM indicates TCP
serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
serversocket.bind(("localhost", 10000))
serversocket.listen(1)

(clientsocket, address) = serversocket.accept()
msg = clientsocket.recv(1024)
print "server recieved " + msg
```


```python
# client_tcp.py
import socket

# socket.SOCK_STREAM indicates TCP
clientsocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
clientsocket.connect(("localhost", 12345))

msg = "Hello world from client"

print "client sending: " + msg
```


首先在单独的进程中运行 server_tcp 脚本，然后再在另一进程运行 client_tcp 脚本，结果如下：


```
$ python server_tcp.py
server received

$ python client_tcp.py
client sending: Hello world from client
```


可以修改以上示例，通过向 server_tcp 和 client_tcp 脚本添加 send 和 recv 方法来进行双向通信。修改后完整脚本如下：


```python
# server_tcp.py
import socket

# socket.SOCK_STREAM indicates TCP
serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
serversocket.bind(("localhost", 10000))
serversocket.listen(1)

(clientsocket, address) = serversocket.accept()
msg = clientsocket.recv(1024)
print "server recieved " + msg

print "server sending reply"
clientsocket.send("server received your message")
```


```python
# client_tcp.py
import socket

# socket.SOCK_STREAM indicates TCP
clientsocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
clientsocket.connect(("localhost", 10000))

msg = "Hello World from client"

print "client sending: " + msg
clientsocket.send(msg)

msg = clientsocket.recv(1024)
print "client received: " + msg
```


运行结果如下：


```
$ python server_tcp.py
server recieved Hello World from client
server sending reply

$ python client_tcp.py
client sending: Hello World from client
client received: server received your message
```


从上例中可以清楚地看到，如果我们愤怒地（译注：怪怪的副词，不知道怎么翻译会好点？）使用它，很快就要定义一种标准的通信方式，即协议。这将包括消息类型的定义（线文本或者其它
内容？）、消息长度和处理服务端或客户端请求的方法（包括身份难和标准的错误消息）。这就是 HTTP 的由来。

在阅读下文之前，运行服务端脚本并尝试在 web 浏览器打开地址([http://localhost:10000/](http://localhost:10000/))，你应该会看到相同的服务端消息。

### HTTP

HTTP 是为 web 传输的消息定义的协议。如上所述，通过 HTTP 进行的通信通常使用 socket 和 TCP 传输协议。因此，如果我们要修改上面的 server_tcp
示例，那么消息应该会是怎样的呢？

1.  首先是状态行，包括 HTTP 版本号和状态（如果这是一个响应消息的话）。
2.  头部字段，包括：
    *   content-type: 如 text/html 或 application/json（消息格式）；
    *   content-length: （以字节为单位的消息长度）；
3.  空行。
4.  消息体。

下面来修改 server_tcp 脚本：

```python
# server_tcp_http.py
import socket

serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
serversocket.bind(("localhost", 10000))
serversocket.listen(1)

msg = """
HTTP/1.1
Content-Type: text/html

<html>
<body>
<b>Hello world</b>
</body>
</html>
"""

(clientsocket, address) = serversocket.accept()
sent = clientsocket.send(msg)
```


如你所见，我们在 HTTP 消息体中添加了一些 HTML。运行 server_tcp_server 和 client_tcp 脚本，可以看到 client_tcp 脚本输出如下：


```
$ python server_tcp_http.py

$ python client_tcp.py
client sending: Hello World from client
client received:
HTTP/1.1
Content-Type: text/html

<html>
<body>
<b>Hello world</b>
</body>
</html>

```

为了让这看起来更真实，我们可以将 client_tcp 脚本换成 web 浏览器。再次运行 server_tcp_http 脚本，现在用浏览器访问[http://localhost:10000/](http://localhost:10000/)。
浏览器现在可以理解 HTTP 消息并渲染 HTML。

![browser](/assets/images/20190418/WX20190418-155340.png)


还可以修改 server_tcp_http 脚本用来解析`GET`和`POST`请求（以及其它 HTTP 方法），但这超出了本文的范围。Python 提供了很多库来简化 HTTP 通信，而
python 本身也包含 SimpleHTTPServer。因此，很少有人需要直接使用套接字开发 web 服务器——但是，嘿，这很有趣。


> 整理翻译自[http://www.ifnamemain.com/posts/2016/Nov/01/python_sockets_http/](http://www.ifnamemain.com/posts/2016/Nov/01/python_sockets_http/)