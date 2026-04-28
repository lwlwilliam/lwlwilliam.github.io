---
title: JSON Web Token 实现
layout: post
categories: [计算机网络]
keywords: jwt, JSON Web Token
---

### 结构

JSON Web Token 由`.`分隔为三个部分，分别是：

*   `Header`
*   `Payload`
*   `Signature`

如`Header.Payload.Signature`。

##### Header

Header 由两部分组成，签名算法和令牌类型，签名算法有 HMAX SHA256 或 RSA 等，令牌类型则是 JWT。如下所示：

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

##### Payload

Payload 里存放的是实际传送的数据。其中有几个字段是官方推荐的，括号中是字段的全称：

*   iss(Issuer)
*   sub(Subject)
*   aud(Audience)
*   exp(Expiration Time)
*   nbf(Not Before)
*   iat(Issued At)
*   jti(JWT ID)

当然，以上字段并非强制使用，完全可以自定义字段。例如：

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022
}
```

##### Signature

签名需要指定算法。以下是默认的 HMACSHA 算法签名方式，将以上的 Header 和 Payload 经过 base64Url 编码，再用`.`进行拼接，secret 指定的密钥。签名用于验证消息没有被更改。

```
HMACSHA256(
base64UrlEncode(header) + "." +
base64UrlEncode(payload),
secret)
```

##### 合并

将以上的 Header、Payload、Signature 分别进行 base64Url 编码，用`.`进行拼接，最后形成 JSON Web Token。

### 实现

以下代码是官网示例的简版实现，使用了默认算法 HS256 进行签名。

```go
// jwt.go
package main

import (
    "bytes"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "log"
    "strings"
)

type Header struct {
    Alg string `json:"alg"`
    Typ string `json:"typ"`
}

type Payload struct {
    Sub  string `json:"sub"`
    Name string `json:"name"`
    Iat  int    `json:"iat"`
}

func main() {
    header := Header{
        "HS256",
        "JWT",
    }
    headerSli, err := json.Marshal(header)
    if err != nil {
        log.Fatal(err)
    }
    headerStr := base64.RawURLEncoding.EncodeToString(headerSli)

    payload := Payload{"1234567890", "John Doe", 1516239022}
    payloadSli, err := json.Marshal(payload)
    if err != nil {
        log.Fatal(err)
    }
    payloadStr := base64.RawURLEncoding.EncodeToString(payloadSli)

    hp := bytes.Join([][]byte{[]byte(headerStr), []byte(payloadStr)}, []byte{'.'})
    secret := []byte("Hello world")
    h := hmac.New(sha256.New, secret)
    _, err = h.Write(hp)
    if err != nil {
        log.Fatal(err)
    }
    signStr := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

    jwt := strings.Join([]string{headerStr, payloadStr, signStr}, ".")
    fmt.Println(jwt)
}
```

以上代码结果如下，可以跟官网的结果进行对比验证。

```bash
$ go run jwt.go
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.O0t7UHnKu0-Q30CpQa1-Oi9TdUQ-fSktY3M4G6O0mPU
```

![jwt](/assets/images/2021/0827/WX20210827-150452.png)

服务器在生成 jwt 时，对生成的 jwt 和 secret 进行绑定保存，在客户端将 jwt 回传时即能过 base64 解码获取对应原内容进行验证。

由于 JSON Web Token 保存在客户端，所以不要存放敏感数据。