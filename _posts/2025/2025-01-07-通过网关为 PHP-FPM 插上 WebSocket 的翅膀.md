---
title: 通过网关为 PHP-FPM 插上 WebSocket 的翅膀
layout: post
categories: [PHP]
keywords: WebSocket,php,php-fpm,Go
---

众所周知，运行在`PHP-FPM`模式下的`PHP`代码并非常驻内存，而`WebSocket`实时通信又需要常驻内存，可以说`PHP-FPM`模式跟
`WebSocket`就走不到一块去。

虽然可以直接使用`AMPHP`、`REACTPHP`、`Swoole`等众多`PHP-CLI`的库和扩展来让`PHP`处理`WebSocket`业务，但这就相当于做一个新项目了，跟原有的`PHP-FPM`项目不能很好地兼容。通过`WebSocket`网关跟`WebSocket`客户端交互，具体的业务仍然由`PHP-FPM`框架处理，不仅能以零改动的方式让`PHP-FPM`拥有了处理`WebSocket`协议的能力，还不会存在`PHP-FPM`和`PHP-CLI`之间生态不兼容的问题。当然最重要的就是不需要更换框架。

架构图如下所示。

![websocket-gateway](/assets/images/2025/websocket-gateway.png)

`WebSocket 客户端`跟`WebSocket 网关`建立连接，`WebSocket 网关`接收到`WebSocket 客户端`发送的数据，通过`HTTP`协议将数据发送到`Nginx`，`Nginx`再用`FastCGI`协议发送给`PHP-FPM`，`PHP`脚本处理完将数据沿原路反方向回传到`WebSocket 客户端`，这是接收逻辑；如果希望`PHP`主动推送数据到`WebSocket 客户端`，则需要额外的`HTTP 客户端`，因为`PHP-FPM`不适合持续运行推送，不过这个并不算关键的功能，理论上完全可以通过`WebSocket 网关`来定时触发，此处不作详细说明。主动推送时，`HTTP 客户端`向`Nginx`发起`HTTP`请求，由`PHP-FPM`处理，如果`PHP`脚本判断该请求需要推送到`WebSocket 客户端`，则将数据发送至`WebSocket 网关`对内暴露的`HTTP`接口，`WebSocket 网关`根据请求选择对应的`WebSocket 客户端`通信。

### PHP 业务代码

`websocket.php`为`PHP`和`WebSocket 客户端`交互的业务逻辑，访问链接为`http://localhost/websocket.php` 。除了要区分接收和发送行为之外，其它逻辑与一般`PHP-FPM`项目无异。其中`$url`变量为`WebSocket 网关`开放的接口，该接口供`PHP`主动推送消息给`WebSocket 客户端`。

```php
<?php
// websocket.php

if (
	!empty($_POST['type'])
	&& !empty($_POST['client_id'])
	&& isset($_POST['message'])
) {
	if ($_POST['type'] == 'client') {
		// 接收客户端消息，推送到 client_id 对应的 WebSocket 客户端
		$url = 'http://host.docker.internal:8080/send';
    	$cmd = sprintf('curl -d "message=%s&type=client&client_id=%s" %s', $_POST['message'], $_POST['client_id'], $url);
		system($cmd);
		echo PHP_EOL, $cmd, PHP_EOL;
	} else {
		// 接收处理 WebSocket 客户端消息
		switch ($_POST['message']) {
		case 'name':
			echo 'lwlinux';
			break;
		default:
			echo 'default';
		}

		echo ' to '. $_POST['client_id'];
	}
} else {
	echo 'something wrong';
}
```

### WebSocket 网关

`WebSocket 网关`的核心功能有两个，一个面向`WebSocket 客户端`，也就是`ws://localhost:8080/ws`，对连接进行保活；另一个面向`PHP`，提供`PHP`主动推送的接口，将数据转发到`WebSocket 客户端`，即`http://host.docker.internal:8080/send` ，该接口接收`POST`请求，表单参数包括`message`、`client_id`（`WebSocket 客户端`的唯一标识）。启动前，需要提前知道`PHP`服务地址`http://localhost/websocket.php` 。

```go
package main

import (
	"bytes"
	"fmt"
	"github.com/gorilla/websocket"
	"io/ioutil"
	"log"
	"net/http"
	"sync"
	"time"
)

const (
	phpFpmURL = "http://localhost/websocket.php"
	wsAddr    = "localhost:8080"
	wsPath    = "/ws"
)

type WebSocketGateway struct {
	connections sync.Map
}

func (gw *WebSocketGateway) Start() {
	http.HandleFunc(wsPath, gw.handleWebSocket)
	http.HandleFunc("/send", gw.handleSendMessage)
	log.Printf("WebSocket server started at ws://%s%s", wsAddr, wsPath)
	err := http.ListenAndServe(wsAddr, nil)
	if err != nil {
		log.Fatalf("Error starting WebSocket server: %v", err)
	}
}

func (gw *WebSocketGateway) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	upGrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	conn, err := upGrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	clientID := fmt.Sprintf("%s", conn.RemoteAddr().String())
	gw.connections.Store(clientID, conn)
	log.Printf("New WebSocket connection: %s", clientID)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error for client %s: %v", clientID, err)
			break
		}

		log.Printf("Received message from client %s: %s", clientID, p)

		resp, err := sendToPhpFpm(string(p), clientID)
		if err != nil {
			log.Println("Error communicating with PHP-FPM:", err)
			continue
		}

		err = conn.WriteMessage(messageType, resp)
		if err != nil {
			log.Printf("Write error for client %s: %v", clientID, err)
			break
		}
	}

	gw.connections.Delete(clientID)
	log.Printf("WebSocket connection closed: %s", clientID)
}

func sendToPhpFpm(message, clientID string) ([]byte, error) {
	reqBody := fmt.Sprintf("type=server&message=%s&client_id=%s", message, clientID)
	req, err := http.NewRequest("POST", phpFpmURL, bytes.NewBuffer([]byte(reqBody)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return respBody, nil
}

func (gw *WebSocketGateway) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	err := r.ParseForm()
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(http.StatusText(http.StatusBadRequest)))
		return
	}

	clientID := r.Form.Get("client_id")
	message := r.Form.Get("message")
	_ = r.Form.Get("type")

	conn, ok := gw.connections.Load(clientID)
	if !ok {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	wsConn := conn.(*websocket.Conn)

	err = wsConn.WriteMessage(websocket.TextMessage, []byte(message))
	if err != nil {
		http.Error(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	w.Write([]byte("Message sent"))
}

func main() {
	gateway := &WebSocketGateway{}
	gateway.Start()
}
```

首先运行`WebSocket 网关`。

### WebSocket 客户端

在浏览器控制台执行以下代码。

```javascript
var ws = new WebSocket('ws://127.0.0.1:8080/ws')
ws.onopen = function (params) {
    ws.send('name')
    ws.send('')
}
ws.onmessage = function (params) {
    console.log(params.data)
}
ws.onclose = function (params) {
    console.log('close')
}
ws.onerror = function (params) {
    console.log('error')
}
```

输出以下内容。

```
lwlinux to 127.0.0.1:51110
default to 127.0.0.1:51110
```

### PHP 推送消息到 WebSocket 客户端

通过`curl`调用`PHP`代码，`client_id`根据实际情况修改，通过浏览器调用`PHP`发送消息同理。

```
$ curl -d 'message=hello_world_from_curl&client_id=127.0.0.1:51110&type=client' http://localhost/websocket.php
Message sent
curl -d "message=hello_world_from_curl&type=client&client_id=127.0.0.1:51110" http://host.docker.internal:8080/send
```

这时，`WebSocket 客户端`应该会输出该文本`hello_world_from_curl`。

这个思路不仅可以用于为`PHP-FPM`添加`WebSocket`功能，还可以为`PHP-FPM`做连接池等等。