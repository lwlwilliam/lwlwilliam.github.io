---
title: 通过 Chrome DevTools Protocol 协议控制浏览器
layout: post
categories: [工具]
keywords: 无头浏览器,headless,CDP,Chrome DevTools Protocol,selenium
---

之前写过`Selenium`是怎么指挥浏览器运行的，其中提到过通过`CDP(Chrome DevTools Protocol)`协议可以直接绕过浏览器驱动来控制浏览器。`CDP`本质上就是通过`WebSocket`协议传输`JSON`格式的命令。

使用`CDP`时，无需浏览器驱动，但依然依赖浏览器。因此，控制浏览器的第一步就是启动浏览器。这里我们使用`ps ajx`命令结果是否包含`Chrome`、`headless`两个关键词来判断是否已启动`CDP`服务，也就是代码中的`chromeHeadlessRunning`函数：

```go
func chromeHeadlessRunning() (bool, error) {
    cmd := exec.Command("ps", "ajx")
    output, err := cmd.Output()
    if err != nil {
        return false, err
    }

    scanner := bufio.NewScanner(strings.NewReader(string(output)))
    for scanner.Scan() {
        line := scanner.Text()
        if strings.Contains(line, "Chrome") &&
            strings.Contains(line, "headless") &&
            !strings.Contains(line, "grep") {
            return true, nil
        }
    }

    return false, nil
}
```

怎么判断启动`CDP`服务的命令确实拉起了`CDP`？`CDP`协议使用常用的`TCP/IP`协议栈，只需要发起连接多次几次，成功建立连接视为服务成功启动。

```go
func waitForCDP(port string, timeout time.Duration) bool {
    deadline := time.Now().Add(timeout)
    for time.Now().Before(deadline) {
        conn, err := net.DialTimeout("tcp", port, time.Second)
        if err == nil {
            conn.Close()
            return true
        }
        time.Sleep(200 * time.Millisecond)
    }
    return false
}
```

到这一步，基本的要求都已满足。那么通过`HTTP`的`PUT`方法新建一个页面，并获取对应的`webSocketDebuggerUrl`用于后续交互。

```go
func getDebuggerInfo() interface{} {
    httpClient := http.Client{}
    req, err := http.NewRequest(http.MethodPut, debuggerBaseUrl+"/json/new", nil)
    isFatal(err)

    res, err := httpClient.Do(req)
    isFatal(err)
    defer res.Body.Close()

    bodyBytes, err := io.ReadAll(res.Body)
    isFatal(err)

    var i interface{}
    err = json.Unmarshal(bodyBytes, &i)
    isFatal(err)

    return i
}
```

现在就可以通过`webSocketDebuggerUrl`建立`WebSocket`连接控制浏览器了。以获取`https://baidu.com`网页标题为例：

```go
func testWeb() {
    testUrl := "https://baidu.com"
    var readTimeout time.Duration = 3
    debugInfo := getDebuggerInfo()
    if v, ok := debugInfo.(map[string]interface{}); ok {
        if wsUrl, ok := v["webSocketDebuggerUrl"].(string); ok {
            wsClient, err := websocket.Dial(wsUrl, "", debuggerBaseUrl)
            defer wsClient.Close()
            isFatal(err)
            _, err = wsClient.Write([]byte(`{"id":1,"method":"Page.navigate","params":{"url":"` + testUrl + `"}}`))
            isFatal(err)
            b := make([]byte, 1)

            log.Println(wsClient.SetReadDeadline(time.Now().Add(time.Second * readTimeout)))
            for n, err := wsClient.Read(b); err == nil && n > 0; n, err = wsClient.Read(b) {
                fmt.Printf("%s", b[:n])
            }
            fmt.Println()

            _, err = wsClient.Write([]byte(`{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.title","returnByValue":true}}`))
            isFatal(err)
            log.Println(wsClient.SetReadDeadline(time.Now().Add(time.Second * readTimeout)))

            resJson := make([]byte, 0) // 用于处理百度的中文标题
            for n, err := wsClient.Read(b); err == nil && n > 0; n, err = wsClient.Read(b) {
                fmt.Printf("%s", b[:n])
                resJson = append(resJson, b[:n]...)
            }
            fmt.Println()

            x := struct {
                Id     int `json:"id"`
                Result struct {
                    Result struct {
                        Type  string `json:"type"`
                        Value string `json:"value"`
                    }
                }
            }{}

            err = json.Unmarshal(resJson, &x)
            if err != nil {
                log.Println(err)
            }
            fmt.Println(x.Result.Result.Value)
        } else {
            log.Printf("WebSocketDebuggerUrl 不是字符串: %#v\n", wsUrl)
        }
    } else {
        log.Println("响应体不是 JSON 格式")
    }
}
```

完整的代码如下：

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "golang.org/x/net/websocket"
    "io"
    "log"
    "net"
    "net/http"
    "os/exec"
    "strings"
    "time"
)

var debuggingPort = "9222"
var debuggerBaseUrl = "http://127.0.0.1:" + debuggingPort
var command = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
var options = []string{"--remote-debugging-port=" + debuggingPort, "--headless", "--disable-gpu", "--no-sandbox", "--user-data-dir=/tmp/chromeCDP", "--remote-allow-origins=*"}

func isFatal(err error) {
    if err != nil {
        log.Fatalln(err)
    }
}

func chromeHeadlessRunning() (bool, error) {
    cmd := exec.Command("ps", "ajx")
    output, err := cmd.Output()
    if err != nil {
        return false, err
    }

    scanner := bufio.NewScanner(strings.NewReader(string(output)))
    for scanner.Scan() {
        line := scanner.Text()
        if strings.Contains(line, "Chrome") &&
            strings.Contains(line, "headless") &&
            !strings.Contains(line, "grep") {
            return true, nil
        }
    }

    return false, nil
}

func waitForCDP(port string, timeout time.Duration) bool {
    deadline := time.Now().Add(timeout)
    for time.Now().Before(deadline) {
        conn, err := net.DialTimeout("tcp", port, time.Second)
        if err == nil {
            conn.Close()
            return true
        }
        time.Sleep(200 * time.Millisecond)
    }
    return false
}

func getDebuggerInfo() interface{} {
    httpClient := http.Client{}
    req, err := http.NewRequest(http.MethodPut, debuggerBaseUrl+"/json/new", nil)
    isFatal(err)

    res, err := httpClient.Do(req)
    isFatal(err)
    defer res.Body.Close()

    bodyBytes, err := io.ReadAll(res.Body)
    isFatal(err)

    var i interface{}
    err = json.Unmarshal(bodyBytes, &i)
    isFatal(err)

    return i
}

func testWeb() {
    testUrl := "https://baidu.com"
    var readTimeout time.Duration = 3
    debugInfo := getDebuggerInfo()
    if v, ok := debugInfo.(map[string]interface{}); ok {
        if wsUrl, ok := v["webSocketDebuggerUrl"].(string); ok {
            wsClient, err := websocket.Dial(wsUrl, "", debuggerBaseUrl)
            defer wsClient.Close()
            isFatal(err)
            _, err = wsClient.Write([]byte(`{"id":1,"method":"Page.navigate","params":{"url":"` + testUrl + `"}}`))
            isFatal(err)
            b := make([]byte, 1)

            log.Println(wsClient.SetReadDeadline(time.Now().Add(time.Second * readTimeout)))
            for n, err := wsClient.Read(b); err == nil && n > 0; n, err = wsClient.Read(b) {
                fmt.Printf("%s", b[:n])
            }
            fmt.Println()

            _, err = wsClient.Write([]byte(`{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.title","returnByValue":true}}`))
            isFatal(err)
            log.Println(wsClient.SetReadDeadline(time.Now().Add(time.Second * readTimeout)))

            resJson := make([]byte, 0) // 用于处理百度的中文标题
            for n, err := wsClient.Read(b); err == nil && n > 0; n, err = wsClient.Read(b) {
                fmt.Printf("%s", b[:n])
                resJson = append(resJson, b[:n]...)
            }
            fmt.Println()

            x := struct {
                Id     int `json:"id"`
                Result struct {
                    Result struct {
                        Type  string `json:"type"`
                        Value string `json:"value"`
                    }
                }
            }{}

            err = json.Unmarshal(resJson, &x)
            if err != nil {
                log.Println(err)
            }
            fmt.Println(x.Result.Result.Value)
        } else {
            log.Printf("WebSocketDebuggerUrl 不是字符串: %#v\n", wsUrl)
        }
    } else {
        log.Println("响应体不是 JSON 格式")
    }
}

func main() {
    running, err := chromeHeadlessRunning()
    isFatal(err)

    if !running {
        fmt.Println("未检测到 Chrome headless，启动中...")
        go func() {
            err := exec.Command(command, options...).Run()
            isFatal(err)
        }()
        fmt.Println("等待 Chrome headless 启动...")

        if !waitForCDP("127.0.0.1:"+debuggingPort, 10*time.Second) {
            fmt.Println("Chrome headless 启动超时")
            return
        }
        fmt.Println("Chrome headless 启动成功")
    } else {
        fmt.Println("Chrome headless 已在运行")
    }

    fmt.Println("执行后续逻辑...")

    testWeb()
}
```