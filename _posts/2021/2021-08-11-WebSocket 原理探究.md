---
title: WebSocket 原理探究
layout: post
categories: [计算机网络]
keywords: WebSocket
---

WebSocket 究竟是什么东西呢？貌似有人看到 WebSocket 里面有 `Socket` 就以为它跟 Socket 有什么关系。呃，要真说它们有什么关系，也确实有，WebSocket 跟 Socket 之间还隔着一层 HTTP，姑且算是有关系吧。

WebSocket 协议是基于 HTTP 实现的，具体来说，WebSocket 通过 HTTP 实现握手，握手之后就没 HTTP 什么事了。

为了深刻理解 WebSocket 原理，我特意写了个 WebSocket 服务，目前仅能握手、接发简短的文本信息，但用于简单说明 WebSocket 工作机制已经足够了。

```go
package main

import (
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net"
	"strings"
)

const Series = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

func main() {
	S()
}

func S() {
	l, err := net.Listen("tcp", "localhost:9999")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("listening %s...", l.Addr())

	for {
		conn, err := l.Accept()
		if err != nil {
			log.Println(err)
			continue
		}
		log.Printf("%s accepted...", conn.RemoteAddr())

		go handleS(&conn)
	}
}

func handleS(conn *net.Conn) {
	log.Printf("handling %s...", (*conn).RemoteAddr())

	buf := make([]byte, 1024)
	// demo 默认一次读完
	n, err := (*conn).Read(buf)
	if err != nil {
		log.Println(err)
	}

	lines := strings.Split(string(buf[:n]), "\r\n")
	headers := map[string]string{}
	for _, line := range lines {
		// headers
		row := strings.Split(line, ":")
		if len(row) == 2 {
			key := strings.TrimSpace(row[0])
			val := strings.TrimSpace(row[1])
			headers[key] = val
		}
	}

	_, hasConnection := headers["Connection"]
	_, hasUpgrade := headers["Upgrade"]
	if hasConnection && hasUpgrade {
		// handshake
		key := headers["Sec-WebSocket-Key"]
		str := key + Series
		src := sha1.Sum([]byte(str))
		dst := base64.StdEncoding.EncodeToString(src[:])

		_, err := (*conn).Write([]byte(fmt.Sprintf("%s\r\n%s\r\n%s\r\n%s\r\n%s\r\n%s%s\r\n\r\n",
			"HTTP/1.1 101 Switching Protocols",
			"Connection: Upgrade",
			"Upgrade: websocket",
			"Server: Go",
			"Sec-WebSocket-Version: 13",
			"Sec-WebSocket-Accept: ",
			dst)))

		if err != nil {
			log.Println(err)
		}

		go handleWebsocket(conn)

	} else {
		_, err := (*conn).Write([]byte(fmt.Sprintf("%s\r\n%s\r\n%s\r\n\r\n%s",
			"HTTP/1.1 400 Bad Request",
			"Server: Go",
			"Content-Length: 15",
			"400 Bad Request")))
		if err != nil {
			log.Println(err)
		}
		// TODO
		log.Printf("close bad request %s...", (*conn).RemoteAddr())
		defer (*conn).Close()
	}
}

func handleWebsocket(conn *net.Conn) {
	defer (*conn).Close()

	buf := make([]byte, 1024)
	for {
		n, err := (*conn).Read(buf)
		if err != nil {
			if err == io.EOF {
				log.Printf("close websocket %s...", (*conn).RemoteAddr())
				break
			}

			log.Println(err)
			continue
		}

		fmt.Printf("recvData: %#x\n", buf[:n])
		var maskKey []byte
		for k, v := range buf[:n] {
			// k 为第 k+1 个字节
			switch k {
			case 0:
				// FIN，1位，0x80 表示结束
				fmt.Printf("fin: %#x\n", v&0b10000000)

				// RSV1/RSV2/RSV3，共3位
				fmt.Printf("RSV: %#x\n", v&0b01110000)

				// OPCODE，4位，1 表示文本数据；2 表示二进制数据帧
				fmt.Printf("opcode: %#x\n", v&0b00001111)
			case 1:
				// MASK，1位，表示是否使用掩码
				fmt.Printf("mask: %#x\n", v&0b10000000)
				// payload len，7位，最大值为 2^7 = 127，如果值为 0-125，则是 payload 的真实长度；如果值为 126，则后面的两字节表示的无符号整才是真正的 payload len；
				// 如果值为 127，则后面的八字节表示的无符号整数才是真正的 payload len
				fmt.Printf("payload len: %#x\n", v&0b01111111)
			case 2:
				// nothing to do
			case 3:
				// nothing to do
			case 4:
				// nothing to do
			case 5:
				// mask-key，4字节
				maskKey = buf[2:6]
				fmt.Printf("mask-key: %#x\n", buf[2:6])
			case len(buf[:n]) - 1:
				// payload
				fmt.Printf("payload: ")
				//fmt.Printf("%#x\n", buf[6:n])
				for k, v := range buf[6:n] {
					fmt.Printf("%c", maskKey[k%4]^byte(v))
				}
				fmt.Println()
			}
		}
		fmt.Printf("\n")

		sendPayload := []byte{'w', 'o', 'r', 'l', 'd'}
		sendData := []byte{
			0b10000001, 0b00000101,
		}

		sendData = append(sendData, sendPayload...)
		fmt.Printf("sendData: %#x(%s)\n", sendData, sendData)
		(*conn).Write(sendData)
	}
}
```

简单解释一下以上代码。Socket 代码自不必多说，Accept 连接之后，需要对接收到的消息进行判断，如果有`Connection: Upgrade`和`Upgrade: websocket`请求头的话，则进入 WebSocket 握手处理。WebSocket 握手时，HTTP 报文还会带上`Sec-WebSocket-Key`请求头，这个 Key 值是由客户端随机生成的（也是经过 base64 编码的），我们将这个 Key 拼接上`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`，这个字符串是固定的，用这个串的原因得查一下 RFC 才知道了；接着将拼接之后的字符串进行 sha1 散列，最后再 base64 编码。我们回复握手报文至此已经准备好了，将上面生成的 base64 编码字符中添加到`Sec-WebSocket-Accept`响应头上，其它内容可以固定，当然也可以加上其它响应头，但现在这样的代码足够让实验成功了。

握手成功之后，Accept 建立的连接千万不要 Close，我们后面的 WebSocket 消息就靠它来传输了。另外，这个连接应当要对进来的消息进行校验。

运行上以代码。现在打开浏览器的控制台测试一下吧，输入以下代码。

```js
var ws = new WebSocket('ws://localhost:9999');
ws.onopen = function() {
    console.log('open');
    ws.send('hello');
}
ws.onmessage = function(e) {
    console.log(e.data);
}
```

控制台应该会打印以下文本：

```
open
world
```

而服务端的输出应该如下：

```
2021/09/08 16:33:52 127.0.0.1:59588 accepted...
2021/09/08 16:33:52 handling 127.0.0.1:59588...
recvData: 0x818588c6e0b9e0a38cd5e7
fin: 0x80
RSV: 0x0
opcode: 0x1
mask: 0x80
payload len: 0x5
mask-key: 0x88c6e0b9
payload: hello

sendData: 0x8105776f726c64(�world)
```

以上就是一个完整简单可测试的 WebSocket 服务示例。

WebSocket 也并不是什么特别高端的玩意。