---
title: Cookie 和 Session
layout: post
category: [计算机网络]
---

HTTP 协议是无状态的，用户的每一次请求都是独立的。有时候我们需要知道哪些请求是跟用户相关的，例如，购物车的商品属于哪个用户。web 规范给出的解决方案是经典的 cookie 和 session。cookie 是一种客户端机制，将用户的数据保存到客户端；session 是一种服务端机制，将数据以类似于散列表的结构来保存信息，这是用 PHP 内置函数生成的 session 数据格式：`last_regenerate|i:1550546460;app_id|s:1:"2";`。每个网站访客都会被分配一个唯一的标识符，即 sessionID。

### Cookie

cookie 是由服务端生成的，客户端通过请求获取 cookie 并保存在用户计算机，在之后的请求会把 cookie 附在 HTTP 报文中，用于标识用户身份。cookie 类似于我们的身份证，是由政府（服务端）生成用于标识我们的身份。Cookie 是有时间限制的。服务端是通过 HTTP 响应报文通知客户端设置 cookie 的，如下`Set-Cookie`头部所示：

```
HTTP/1.1 200 OK
Set-Cookie: test=testValue
Content-Length: 0
```

客户端在收到报文后会生成一个文件保存 cookie，并且在之后的请求中，客户端的请求都会带上一个 cookie 头部向服务端表明身份，服务端就能向客户端展示专属的信息：

```
GET / HTTP/1.1
Host: test.id
Cookie: test=testValue
```

### Session

session 同样是由服务端生成的。由于 cookie 是保存在客户端的，存在一定的安全隐患，某些敏感数据不适合保存在 cookie 中，而 session 保存在服务端相对来说则比较安全。

session 的基本原理是由服务端为每个会话维护一份数据，并生成一个 sessionID 给客户端来访问这份数据，以达到交互的目的。创建 session 的过程可以概括为三个步骤：

1.  生成全局唯一标识符(sessionID)；
2.  开辟数据存储空间。可以在内存或者文件、数据库中创建相应的数据结构，各种存储介质各有利弊，应根据实际选择；
3.  将 sessionID 发送给客户端；

以上三步关键在于如何发送 sessionID 到客户端。考虑到 HTTP 协议的定义，数据无非可以放到请求行、头域或 Body 里，所以一般来说会有两种常用的方式：cookie 和 URL 重写。cookie 好理解，就是把 sessionID 通过`Set-Cookie`头传送到客户端；URL 重写则是在返回给用户的页面的所有 URL 后面追加 sessionID，例如首页由`http://example.com`重写为`http://example.com?sessionid=SESSIONID`，这种做法不安全且比较麻烦，但是，如果客户端禁用了 cookie 的话，这种方案将会是首选。

### Go 实现 session 管理

目前 Go 标准包没有为 session 提供任何支持，现在自己动手来实现 Go 的 session 管理和创建。

session 管理涉及到如下几个因素：

*   全局 session 管理器；
*   保证 sessionID 的全局唯一性；
*   为每个客户关联一个 session；
*   session 的存储（可以存储到内存、文件、数据库等）；
*   session 过期处理；

项目结构如下：

```
- $GOPATH/src/github.com/lwlwilliam
    - sessionDemo
        - session
            - providers
                - memory
                    memory.go
            session.go
        - templates
            login.gtpl 
        main.go
```

具体代码如下。

#### sessionDemo/session/session.go

```go
package session

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type Session interface {
	Set(key, value interface{}) error // set session value
	Get(key interface{}) interface{}  // get session value
	Delete(key interface{}) error     // delete session value
	SessionID() string                // back current sessionID
}

// session 是保存在服务器端的数据，可以以任何方式存储，比如存储在内存、数据库或者文件中。
// 因此抽象出一个 Provider 接口，用以表征 session 管理器底层存储结构
type Provider interface {
	SessionInit(sid string) (Session, error) // 实现 session 初始化
	SessionRead(sid string) (Session, error) // 返回 sid 代表的 session
	SessionDestroy(sid string) error         // 销毁 sid 对应的 session
	SessionGC(maxLifeTime int64)             // 根据 maxLifeTime 来删除过期的数据
}

var provides = make(map[string]Provider)

// 注册 session 管理器 provider
func Register(name string, provider Provider) {
	if provider == nil {
		panic("session: Register provider is nil")
	}

	if _, dup := provides[name]; dup {
		panic("session: Register called twice for provider " + name)
	}

	provides[name] = provider
}

// 全局 session 管理器
type Manager struct {
	cookieName  string     // private cookiename
	lock        sync.Mutex // protects session
	provider    Provider
	maxLifeTime int64
}

func NewManager(provideName, cookieName string, maxLifeTime int64) (*Manager, error) {
	provider, ok := provides[provideName]
	if !ok {
		return nil, fmt.Errorf("session: unknown provide %q (forgotten import?)", provideName)
	}
	return &Manager{provider: provider, cookieName: cookieName, maxLifeTime: maxLifeTime}, nil
}

// 生成 sessionID
func (manager *Manager) sessionID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return base64.URLEncoding.EncodeToString(b)
}

// 生成 session，并把 sessionID 传送给客户端
func (manager *Manager) SessionStart(w http.ResponseWriter, r *http.Request) (session Session) {
	manager.lock.Lock()
	defer manager.lock.Unlock()
	cookie, err := r.Cookie(manager.cookieName)
	// cookie 中是否已经存在 sessionID 了
	if err != nil || cookie.Value == "" {
		sid := manager.sessionID()
		session, err = manager.provider.SessionInit(sid)
		cookie := http.Cookie{Name: manager.cookieName, Value: url.QueryEscape(sid), Path: "/", HttpOnly: true, MaxAge: int(manager.maxLifeTime)}
		http.SetCookie(w, &cookie)
	} else {
		sid, _ := url.QueryUnescape(cookie.Value)
		session, _ = manager.provider.SessionRead(sid)
	}

	return
}

// 销毁 session，并通过响应头部 Set-Cookie 对 cookie 进行过期时间设置达到销毁 cookie 的目的
func (manager *Manager) SessionDestroy(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(manager.cookieName)
	// 是否需要对 cookie 进行处理
	if err != nil || cookie.Value == "" {
		return
	} else {
		manager.lock.Lock()
		defer manager.lock.Unlock()
		manager.provider.SessionDestroy(cookie.Value)
		expiration := time.Now()
		cookie := http.Cookie{Name: manager.cookieName, Path: "/", HttpOnly: true, Expires: expiration, MaxAge: -1}
		http.SetCookie(w, &cookie)
	}
}

// 销毁
func (manager *Manager) GC() {
	manager.lock.Lock()
	defer manager.lock.Unlock()
	manager.provider.SessionGC(manager.maxLifeTime)

	// 利用 time 包中的定时器功能，当超时 maxLifeTime 之后调用 GC 函数，
	// 这样就可以保证 maxLifeTime 时间内的 session 都是可用的，
	// 类似的方案也可以用于统计在线用户数之类的。
	time.AfterFunc(time.Duration(manager.maxLifeTime), func() {
		manager.GC()
	})
}
```

#### sessionDemo/session/providers/memory/memory.go

```go
package memory

import (
	"container/list"
	"log"
	"sync"
	"time"

	"github.com/lwlwilliam/sessionDemo/session"
)

var pder = &Provider{list: list.New()}

type SessionStore struct {
	sid          string                      // sessionID
	timeAccessed time.Time                   // 最后访问时间
	value        map[interface{}]interface{} // session 里面存储的值
}

func (st *SessionStore) Set(key, value interface{}) error {
	st.value[key] = value
	pder.SessionUpdate(st.sid)
	return nil
}

func (st *SessionStore) Get(key interface{}) interface{} {
	pder.SessionUpdate(st.sid)
	if v, ok := st.value[key]; ok {
		return v
	} else {
		return nil
	}
}

func (st *SessionStore) Delete(key interface{}) error {
	delete(st.value, key)
	pder.SessionUpdate(st.sid)
	return nil
}

func (st *SessionStore) SessionID() string {
	return st.sid
}

type Provider struct {
	lock     sync.Mutex
	sessions map[string]*list.Element
	list     *list.List
}

func (pder *Provider) SessionInit(sid string) (session.Session, error) {
	pder.lock.Lock()
	defer pder.lock.Unlock()
	v := make(map[interface{}]interface{}, 0)
	newsess := &SessionStore{sid: sid, timeAccessed: time.Now(), value: v}
	log.Println("init:", newsess)

	element := pder.list.PushBack(newsess)
	pder.sessions[sid] = element
	return newsess, nil
}

func (pder *Provider) SessionRead(sid string) (session.Session, error) {
	if element, ok := pder.sessions[sid]; ok {
		return element.Value.(*SessionStore), nil
	} else {
		sess, err := pder.SessionInit(sid)
		return sess, err
	}
	return nil, nil
}

func (pder *Provider) SessionDestroy(sid string) error {
	if element, ok := pder.sessions[sid]; ok {
		delete(pder.sessions, sid)
		pder.list.Remove(element)
		return nil
	}
	return nil
}

func (pder *Provider) SessionGC(maxlifetime int64) {
	pder.lock.Lock()
	defer pder.lock.Unlock()

	for {
		element := pder.list.Back()
		if element == nil {
			break
		}
		if (element.Value.(*SessionStore).timeAccessed.Unix() + maxlifetime) < time.Now().Unix() {
			pder.list.Remove(element)
			delete(pder.sessions, element.Value.(*SessionStore).sid)
		} else {
			break
		}
	}
}

func (pder *Provider) SessionUpdate(sid string) error {
	pder.lock.Lock()
	defer pder.lock.Unlock()
	if element, ok := pder.sessions[sid]; ok {
		element.Value.(*SessionStore).timeAccessed = time.Now()
		pder.list.MoveToFront(element)
		return nil
	}
	return nil
}

func init() {
	pder.sessions = make(map[string]*list.Element, 0)
	session.Register("memory", pder)
}
```

#### sessionDemo/templates/login.gtpl

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Document</title>
</head>
<body>
<form action="/login" method="post">
    用户名：<input type="text" name="username">
    密码：<input type="password" name="password">
    <input type="submit" value="login">
</form>
</body>
</html>
```

#### sessionDemo/main.go

```go
package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
	"regexp"

	"github.com/lwlwilliam/sessionDemo/session"
	_ "github.com/lwlwilliam/sessionDemo/session/providers/memory"
)

var globalSessions *session.Manager

func init() {
	globalSessions, _ = session.NewManager("memory", "gosessionid", 3600)
	go globalSessions.GC()
}

func login(w http.ResponseWriter, r *http.Request) {
	sess := globalSessions.SessionStart(w, r)

	r.ParseForm()
	if r.Method == "GET" {
		t, _ := template.ParseFiles("./sessionDemo/templates/login.gtpl")
		w.Header().Set("Content-Type", "text/html")
		t.Execute(w, sess.Get("username"))
		log.Println(sess.Get("username"))
	} else {
		if len(r.Form["username"][0]) == 0 {
			fmt.Fprintf(w, "%s", "the username can not be null")
		} else if m, _ := regexp.MatchString("^[a-z]{3}$", r.Form["username"][0]); !m { // 用户名只能由 3 个 a-z 之间的字符组成
			fmt.Fprintf(w, "%s", "the username is invalid")
		} else {
			sess.Set("username", r.Form["username"][0])
			fmt.Fprintf(w, "%s: %s", "log in successfully", template.HTMLEscapeString(r.Form["password"][0]))
		}

		fmt.Printf("username:%s; password:%s\n", r.Form["username"][0], template.HTMLEscapeString(r.Form["password"][0]))
	}
}

func main() {
	http.HandleFunc("/login", login)
	err := http.ListenAndServe(":9090", nil)
	if err != nil {
		log.Fatal(err)
	}
}
```
