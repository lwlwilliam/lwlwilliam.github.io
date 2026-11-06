/* 博客笔记编辑器 — 前端逻辑 */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var treeEl = $("#tree");
  var fileNameEl = $("#fileName");
  var fileMetaEl = $("#fileMeta");
  var draftBadgeEl = $("#draftBadge");
  var saveBtn = $("#saveBtn");
  var saveStateEl = $("#saveState");
  var countersEl = $("#counters");
  var previewEl = $("#preview");
  var imgInput = $("#imgInput");
  var fileInput = $("#fileInput");
  var newDialog = $("#newDialog");
  var newForm = $("#newForm");

  var currentPath = null;
  var dirty = false;
  var loadingFile = false;
  var previewTimer = null;
  var chromaCSS = "";
  var openYears = new Set();

  /* ---------------- 预览样式 ---------------- */
  var PREVIEW_CSS = [
    ":root{--ptext:#24292f;--pmuted:#6b7280;--pborder:#e5e7eb;--paccent:#3b82f6;--pcode-bg:#f1f3f5;--pquote-bg:rgba(59,130,246,.05);}",
    "@media (prefers-color-scheme:dark){:root{--ptext:#dfe3e8;--pmuted:#8b949e;--pborder:#30363d;--paccent:#60a5fa;--pcode-bg:#22272e;--pquote-bg:rgba(96,165,250,.08);}}",
    "*{box-sizing:border-box;}",
    "html{-webkit-text-size-adjust:100%;}",
    "body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Segoe UI',Roboto,sans-serif;",
    "font-size:15.5px;line-height:1.9;color:var(--ptext);word-break:break-word;}",
    "@media (prefers-color-scheme:dark){body{background:#12161c;}}",
    "@media (min-width:900px){body{padding:46px 48px 90px;}}",
    "@media (max-width:899px){body{padding:24px 20px 60px;}}",
    ".placeholder{color:var(--pmuted);text-align:center;margin-top:24vh;font-size:14px;}",
    "h1,h2,h3,h4{line-height:1.45;margin:1.6em 0 .7em;font-weight:700;}",
    "h1{font-size:1.65em;margin-top:.4em;}",
    "h2{font-size:1.34em;border-bottom:1px solid var(--pborder);padding-bottom:.28em;}",
    "h3{font-size:1.16em;}",
    "h4{font-size:1.04em;}",
    "p{margin:1em 0;}",
    "a{color:var(--paccent);text-decoration:none;}",
    "a:hover{text-decoration:underline;}",
    "img{max-width:100%;display:block;margin:1.2em auto;border-radius:10px;box-shadow:0 2px 14px rgba(0,0,0,.08);}",
    "video{max-width:100%;border-radius:10px;}",
    "li{margin:.45em 0;}",
    "ul,ol{padding-left:1.6em;margin:1em 0;}",
    "blockquote{margin:1.2em 0;padding:.7em 1.1em;border-left:3px solid var(--paccent);background:var(--pquote-bg);border-radius:0 9px 9px 0;color:var(--pmuted);}",
    "blockquote p{margin:.4em 0;}",
    "code{background:rgba(127,140,155,.14);border-radius:5px;padding:.13em .4em;font-size:.88em;",
    "font-family:ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;box-decoration-break:clone;}",
    "pre{background:#0b0e12;border-radius:9px;padding:0;overflow:auto;}",
    "pre>code{background:none;padding:0;border-radius:0;}",
    "table{border-collapse:collapse;margin:1.2em 0;display:block;max-width:100%;overflow-x:auto;}",
    "th,td{border:1px solid var(--pborder);padding:.5em .9em;}",
    "th{background:var(--pcode-bg);font-weight:600;}",
    "hr{border:none;border-top:1px solid var(--pborder);margin:2em auto;}",
    ".math-inline{font-size:.98em;}",
    ".math-display{text-align:center;margin:1.3em 0;overflow-x:auto;overflow-y:hidden;}",
    ".katex{font-size:1.05em;}",
    ".katex-display{margin:.32em 0;}",
    ".footnotes{font-size:.9em;color:var(--pmuted);}",
    "div.highlight{border-radius:9px;overflow:auto;margin:1.3em 0;}",
    "div.highlight pre{margin:0;padding:13px 16px !important;background:#272822 !important;}",
    "div.highlight pre code,.chroma{background:transparent !important;}"
  ].join("\n");

  function buildSrcdoc(bodyHtml) {
    var safe = bodyHtml.replace(/<\/script/gi, "<\\/script");
    return "<!doctype html><html lang=\"zh\"><head><meta charset=\"utf-8\">" +
      "<link rel=\"stylesheet\" href=\"/preview/static/katex/katex.min.css\">" +
      "<style>" + PREVIEW_CSS + "\n" + chromaCSS + "</style>" +
      "<script defer src=\"/preview/static/katex/katex.min.js\"><\/script>" +
      "<script defer src=\"/preview/static/katex/auto-render.min.js\"><\/script>" +
      "<script>window.addEventListener('load',function(){try{if(typeof renderMathInElement!=='function'){return;}renderMathInElement(document.body,{delimiters:[" +
      "{left:'$$',right:'$$',display:true}," +
      "{left:'\\\\(',right:'\\\\)',display:false}," +
      "{left:'\\\\[',right:'\\\\]',display:true}," +
      "{left:'$',right:'$',display:false}" +
      "],throwOnError:false});}catch(e){}});<\/script>" +
      "</head><body>" + safe + "</body></html>";
  }

  function emptyDoc() {
    return "<!doctype html><html><head><meta charset=\"utf-8\"><style>" +
      PREVIEW_CSS + "</style></head><body><div class='placeholder'>从左侧选择一篇文章，或新建文章开始编辑</div></body></html>";
  }

  /* ---------------- 编辑器 ---------------- */
  var cm = CodeMirror.fromTextArea($("#md"), {
    mode: "gfm",
    lineWrapping: true,
    styleActiveLine: { nonEmpty: true },
    extraKeys: {
      "Cmd-S": function () { saveCurrent(); },
      "Ctrl-S": function () { saveCurrent(); },
      "Cmd-B": function () { wrapSelection("**"); },
      "Ctrl-B": function () { wrapSelection("**"); },
      "Cmd-I": function () { wrapSelection("*"); },
      "Ctrl-I": function () { wrapSelection("*"); },
      "Cmd-/": function () { toggleComment(); },
      "Ctrl-/": function () { toggleComment(); }
    }
  });

  cm.on("change", function () {
    if (loadingFile) return;
    setDirty(true);
    schedulePreview();
    updateCountersSoon();
  });

  function wrapSelection(mark) {
    var sel = cm.getSelection();
    if (sel.length >= 2 * mark.length &&
        sel.slice(0, mark.length) === mark &&
        sel.slice(-mark.length) === mark) {
      cm.replaceSelection(sel.slice(mark.length, sel.length - mark.length));
    } else if (sel) {
      cm.replaceSelection(mark + sel + mark);
    } else {
      cm.replaceSelection(mark + " " + mark);
      var cur = cm.getCursor();
      cm.setSelection(
        { line: cur.line, ch: cur.ch - mark.length - 1 },
        { line: cur.line, ch: cur.ch - mark.length });
    }
    cm.focus();
  }

  function toggleComment() {
    var range = cm.listSelections()[0];
    var start = Math.min(range.from().line, range.to().line);
    var end = Math.max(range.from().line, range.to().line);
    for (var l = start; l <= end; l++) {
      var text = cm.getLine(l) || "";
      var t = text.trim();
      if (t === "") continue;
      if (/^\s*<!--.*-->\s*$/.test(text)) {
        cm.replaceRange(text.replace(/^\s*<!--\s?/, "").replace(/\s?-->\s*$/, ""), { line: l, ch: 0 }, { line: l, ch: text.length });
      } else {
        cm.replaceRange("<!-- " + t + " -->", { line: l, ch: 0 }, { line: l, ch: text.length });
      }
    }
    cm.focus();
  }

  /* ---------------- 状态 ---------------- */
  function setDirty(v) {
    dirty = v;
    saveBtn.disabled = !currentPath || !dirty;
    if (!currentPath) {
      saveStateEl.textContent = "未打开文章";
      saveStateEl.classList.remove("dirty");
    } else if (dirty) {
      saveStateEl.textContent = "未保存";
      saveStateEl.classList.add("dirty");
    } else {
      saveStateEl.textContent = "已保存";
      saveStateEl.classList.remove("dirty");
    }
  }

  function fmBlock(content) {
    var m = /^---\n([\s\S]*?)\n---\n/.exec(content) || /^\+\+\+\n([\s\S]*?)\n\+\+\+\n/.exec(content);
    return m ? m[1] : null;
  }
  function isDraft(content) {
    var fm = fmBlock(content);
    if (!fm) return false;
    return /(^|\n)draft\s*:\s*(true|yes|1)\s*($|\n)/i.test(fm);
  }

  var counterTimer = null;
  function updateCountersSoon() {
    if (counterTimer) return;
    counterTimer = setTimeout(function () {
      counterTimer = null;
      updateCounters();
    }, 150);
  }
  function updateCounters() {
    if (!currentPath) { countersEl.textContent = ""; return; }
    var text = cm.getValue();
    var body = text;
    var m = /^---\n[\s\S]*?\n---\n/.exec(text);
    if (m) body = text.slice(m[0].length);
    var lines = cm.lineCount();
    var cjk = (body.match(/[\u4e00-\u9fff]/g) || []).length;
    var words = body.replace(/[\u4e00-\u9fff]/g, " ").split(/\s+/).filter(function (w) { return w; }).length;
    countersEl.textContent = lines + " 行 · " + (cjk + words) + " 字";
  }

  /* ---------------- 预览 ---------------- */
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 220);
  }
  var cssRetries = 0;
  function renderPreview() {
    if (!currentPath) { previewEl.srcdoc = emptyDoc(); return; }
    if (!chromaCSS) {
      // css 尚未就绪，稍后重试
      if (cssRetries++ < 20) setTimeout(renderPreview, 150);
      return;
    }
    fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath, content: cm.getValue() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (typeof d.html === "string") previewEl.srcdoc = buildSrcdoc(d.html);
    }).catch(function (e) { console.warn(e); });
  }

  /* ---------------- 打开/保存 ---------------- */
  function openFile(path) {
    if (dirty && !confirm("当前文章有未保存的修改，继续将丢弃。是否继续？")) {
      markTreeActive(currentPath);
      return;
    }
    fetch("/api/file?path=" + encodeURIComponent(path))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { toast(d.error, true); return; }
        currentPath = d.path;
        loadingFile = true;
        cm.setValue(d.content);
        loadingFile = false;
        draftBadgeEl.classList.toggle("hidden", !isDraft(d.content));
        fileNameEl.textContent = d.path;
        fileMetaEl.title = "content/" + d.path;
        setDirty(false);
        markTreeActive(d.path);
        renderPreview();
        updateCounters();
        cm.focus();
        cm.refresh();
      });
  }

  function saveCurrent() {
    if (!currentPath || !dirty) return;
    saveStateEl.textContent = "保存中…";
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath, content: cm.getValue() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { toast(d.error, true); setDirty(true); return; }
      setDirty(false);
      var now = new Date();
      var t = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2) + ":" + ("0" + now.getSeconds()).slice(-2);
      saveStateEl.textContent = "已保存 " + t;
      draftBadgeEl.classList.toggle("hidden", !isDraft(cm.getValue()));
    }).catch(function (e) { toast("保存失败：" + e, true); });
  }

  /* ---------------- 目录树 ---------------- */
  function loadTree(keepOpen) {
    var prevOpen = keepOpen ? openYears : null;
    document.querySelector("#refreshBtn").classList.add("spin");
    return fetch("/api/posts").then(function (r) { return r.json(); }).then(function (d) {
      renderTree(d.posts || [], prevOpen);
      saveBtn.disabled = true;
    }).catch(function (e) {
      treeEl.innerHTML = "<div class='tree-empty'>加载失败：" + e + "</div>";
    }).finally(function () {
      document.querySelector("#refreshBtn").classList.remove("spin");
    });
  }

  function renderTree(posts, prevOpen) {
    var byYear = new Map();
    posts.forEach(function (p) {
      var y = p.year || "未知";
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(p);
    });
    var years = Array.from(byYear.keys()).sort().reverse();
    var html = "";
    years.forEach(function (y) {
      var isOpen = prevOpen ? prevOpen.has(y)
        : (y === String(new Date().getFullYear()) ||
           (currentPath && byYear.get(y).some(function (p) { return p.path === currentPath; })));
      html += "<details class='year'" + (isOpen ? " open" : "") + " data-year='" + escAttr(y) + "'>" +
        "<summary><svg class='chev' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m9 6 6 6-6 6'/></svg>" +
        "<span>" + escHtml(y) + "</span><span class='count'>" + byYear.get(y).length + "</span></summary><ul class='files'>";
      byYear.get(y).forEach(function (p) {
        html += "<li data-path='" + escAttr(p.path) + "' title='content/" + escAttr(p.path) + "'><span class='t'>" + escHtml(p.title) + "</span>" +
          (p.draft ? "<span class='badge'>草稿</span>" : "") + "</li>";
      });
      html += "</ul></details>";
    });
    treeEl.innerHTML = html || "<div class='tree-empty'>暂无文章</div>";

    openYears = new Set(years.filter(function (y) {
      var d = treeEl.querySelector("details[data-year='" + escAttr(y) + "']");
      return d && d.open;
    }));
    markTreeActive(currentPath);
  }

  treeEl.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-path]");
    if (li) {
      openFile(li.getAttribute("data-path"));
      return;
    }
    var d = e.target.closest("details.year");
    if (d) {
      var y = d.getAttribute("data-year");
      setTimeout(function () {
        openYears[d.open ? "add" : "delete"](y);
      }, 0);
    }
  });

  function markTreeActive(path) {
    treeEl.querySelectorAll("li[data-path]").forEach(function (li) {
      li.classList.toggle("active", li.getAttribute("data-path") === path);
    });
  }

  /* ---------------- 上传 ---------------- */
  imgInput.addEventListener("change", function () {
    if (imgInput.files.length) uploadFiles(imgInput.files, "image");
    imgInput.value = "";
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) uploadFiles(fileInput.files, "file");
    fileInput.value = "";
  });
  $("#imgBtn").addEventListener("click", function () {
    if (!currentPath) { toast("请先打开或新建一篇文章"); return; }
    imgInput.click();
  });
  $("#fileBtn").addEventListener("click", function () {
    if (!currentPath) { toast("请先打开或新建一篇文章"); return; }
    fileInput.click();
  });

  var imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "svg", "ico"];
  function kindForFile(name, mime) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (imageExts.indexOf(ext) >= 0 || (mime && mime.indexOf("image/") === 0)) return "image";
    return "file";
  }

  function uploadFiles(list, kindOverride) {
    if (!currentPath) { toast("请先打开或新建一篇文章"); return; }
    var files = Array.prototype.slice.call(list);
    var chain = Promise.resolve();
    var done = 0;
    files.forEach(function (f) {
      chain = chain.then(function () {
        var kind = kindOverride || kindForFile(f.name, f.type);
        var name = f.name || suggestName(kind, f.type);
        var fd = new FormData();
        fd.append("kind", kind);
        fd.append("path", currentPath);
        fd.append("file", f, name);
        return fetch("/api/upload", { method: "POST", body: fd })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { toast(d.error, true); return; }
            insertBlock(d.insert);
            done++;
          });
      }).catch(function (e) { toast("上传失败：" + e, true); });
    });
    chain.then(function () {
      if (done > 0) toast("已插入 " + done + " 个引用");
      cm.focus();
    });
  }

  function suggestName(kind, mime) {
    var ext = ".png";
    if (mime === "image/jpeg") ext = ".jpg";
    if (mime === "image/gif") ext = ".gif";
    if (mime === "image/webp") ext = ".webp";
    if (kind !== "image") ext = ".bin";
    var d = new Date();
    return "image-" + d.getHours() + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2) + ext;
  }

  function insertBlock(text) {
    var cur = cm.getCursor("to");
    var line = cm.getLine(cur.line) || "";
    var t = text;
    if (line.trim() !== "") t = "\n" + t;
    cm.replaceSelection(t);
    cm.replaceSelection("\n");
  }

  /* 拖拽 & 粘贴上传 */
  var dragDepth = 0;
  var dropHint = document.createElement("div");
  dropHint.id = "dropHint";
  dropHint.textContent = "拖到此处即可上传";
  dropHint.classList.add("hidden");
  $("#editorPane").appendChild(dropHint);

  var editorPane = $("#editorPane");
  editorPane.addEventListener("dragenter", function (e) {
    e.preventDefault();
    dragDepth++;
    if (!currentPath) { toast("请先打开或新建一篇文章"); return; }
    dropHint.classList.remove("hidden");
  });
  editorPane.addEventListener("dragover", function (e) { e.preventDefault(); });
  editorPane.addEventListener("dragleave", function (e) {
    e.preventDefault();
    dragDepth--;
    if (dragDepth <= 0) { dragDepth = 0; dropHint.classList.add("hidden"); }
  });
  editorPane.addEventListener("drop", function (e) {
    e.preventDefault();
    dragDepth = 0;
    dropHint.classList.add("hidden");
    if (e.dataTransfer && e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files, null);
    }
  });

  cm.getWrapperElement().addEventListener("paste", function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && items[i].type && items[i].type.indexOf("image/") === 0) {
        var f = items[i].getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      uploadFiles(files, "image");
    }
  });

  /* ---------------- 新建文章 ---------------- */
  $("#newBtn").addEventListener("click", function () {
    newForm.querySelector("input[name=title]").value = "";
    newForm.querySelector("input[name=category]").value = "";
    newDialog.showModal();
    setTimeout(function () { newForm.querySelector("input[name=title]").focus(); }, 30);
  });
  $("#cancelBtn").addEventListener("click", function () { newDialog.close(); });

  newForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = newForm.querySelector("input[name=title]").value.trim();
    var category = newForm.querySelector("input[name=category]").value.trim();
    if (!title) { toast("请填写文章标题"); return; }
    if (dirty && !confirm("当前文章有未保存的修改，继续将丢弃。是否继续？")) return;
    createBtn.disabled = true;
    fetch("/api/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, category: category })
    }).then(function (r) { return r.json(); }).then(function (d) {
      createBtn.disabled = false;
      if (d.error) { toast(d.error, true); return; }
      newDialog.close();
      loadTree(true).then(function () {
        openFile(d.path);
      });
      toast("已创建 " + d.path);
    }).catch(function (er) {
      createBtn.disabled = false;
      toast("创建失败：" + er, true);
    });
  });

  /* ---------------- 构建 ---------------- */
  var buildBtn = $("#buildBtn");
  var buildDialog = $("#buildDialog");
  buildDialog.querySelector("#buildClose").addEventListener("click", function () { buildDialog.close(); });
  buildBtn.addEventListener("click", function () {
    if (buildBtn.disabled) return;
    buildBtn.disabled = true;
    saveStateEl.textContent = "构建中…";
    saveStateEl.classList.remove("dirty");
    fetch("/api/build", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        buildBtn.disabled = false;
        setDirty(dirty);
        if (d.error) {
          showBuildOutput("构建失败（" + (d.seconds || "?") + "s）", d.output || d.error);
          return;
        }
        if (d.output) {
          showBuildOutput("构建完成（" + d.seconds + "s，有输出/警告）", d.output);
        } else {
          toast("构建成功 " + d.seconds + "s");
        }
      })
      .catch(function (e) {
        buildBtn.disabled = false;
        setDirty(dirty);
        toast("构建失败：" + e, true);
      });
  });

  function showBuildOutput(title, text) {
    $("#buildTitle").textContent = title;
    $("#buildOutput").textContent = text;
    buildDialog.showModal();
  }

  /* ---------------- 编辑器内删除引用的文件 ---------------- */
  /* 右键图片/文件链接（指向 static/assets）→ 菜单删除文件，可同时移除该处引用 */

  function askConfirm(text, okLabel) {
    return new Promise(function (resolve) {
      var dlg = $("#confirmDialog");
      $("#confirmText").textContent = text;
      $("#confirmOk").textContent = okLabel || "删除";
      function done(v) {
        $("#confirmOk").onclick = null;
        $("#confirmCancel").onclick = null;
        dlg.close();
        resolve(v);
      }
      $("#confirmOk").onclick = function () { done(true); };
      $("#confirmCancel").onclick = function () { done(false); };
      dlg.showModal();
    });
  }

  function fmtSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  var ctxMenu = $("#ctxMenu");
  var ctxTarget = null;

  function hideCtx() { ctxMenu.classList.add("hidden"); ctxTarget = null; }

  function collectLinkMatches(lineText) {
    var out = [];
    var m;
    var imgRe = /!\[[^\]]*\]\(\s*([^\s)]+)[^)]*\)/g;
    while ((m = imgRe.exec(lineText))) {
      var uS = m.index + m[0].lastIndexOf("(") + 1;
      out.push({ start: m.index, end: m.index + m[0].length, urlStart: uS, urlEnd: uS + m[1].length, url: m[1], raw: false });
    }
    var lnkRe = /\[[^\]]*\]\(\s*([^\s)]+)[^)]*\)/g;
    while ((m = lnkRe.exec(lineText))) {
      var contained = out.some(function (r) {
        return r.start <= m.index && m.index + m[0].length <= r.end;
      });
      if (contained) continue;
      var uS2 = m.index + m[0].lastIndexOf("(") + 1;
      out.push({ start: m.index, end: m.index + m[0].length, urlStart: uS2, urlEnd: uS2 + m[1].length, url: m[1], raw: false });
    }
    var rawRe = /\b(?:src|poster|data-src|href)\s*=\s*("([^"]+)"|'([^']+)')/g;
    while ((m = rawRe.exec(lineText))) {
      var val = m[2] !== undefined ? m[2] : m[3];
      var uS3 = m.index + m[0].indexOf(m[1]) + 1;
      out.push({ start: m.index, end: m.index + m[0].length, urlStart: uS3, urlEnd: uS3 + val.length, url: val, raw: true });
    }
    return out;
  }

  function resolveStaticRel(url) {
    if (!url) return null;
    var u = url.split("#")[0].split("?")[0];
    if (!u || /^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
    var parts;
    if (u.charAt(0) === "/") {
      parts = u.slice(1).split("/");
    } else if (currentPath) {
      var stack = currentPath.split("/").slice(0, -1);
      u.split("/").forEach(function (s) {
        if (s === "..") stack.pop();
        else if (s !== "." && s !== "") stack.push(s);
      });
      parts = stack;
    } else {
      parts = u.split("/");
    }
    var rel = parts.join("/");
    if (rel.indexOf("static/assets/") === 0) return rel.slice("static/".length);
    if (rel.indexOf("assets/") === 0) return rel;
    return null;
  }

  function showCtxMenu(x, y, target) {
    ctxTarget = target;
    $("#ctxInfo").textContent = target.rel.replace(/^assets\//, "");
    $("#ctxDelBoth").style.display = target.match.raw ? "none" : "";
    ctxMenu.classList.remove("hidden");
    ctxMenu.style.left = Math.min(x, window.innerWidth - ctxMenu.offsetWidth - 10) + "px";
    ctxMenu.style.top = Math.min(y + 4, window.innerHeight - ctxMenu.offsetHeight - 10) + "px";
  }

  cm.getWrapperElement().addEventListener("contextmenu", function (e) {
    hideCtx();
    var pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, "window");
    if (!pos || pos.outside) return;
    var lineText = cm.getLine(pos.line);
    if (!lineText) return;
    var hit = null;
    collectLinkMatches(lineText).forEach(function (m) {
      if (pos.ch >= m.start && pos.ch <= m.end) hit = m;
    });
    if (!hit) return;
    var rel = resolveStaticRel(hit.url);
    if (!rel) return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, { line: pos.line, match: hit, rel: rel, raw: hit.raw });
  });
  document.addEventListener("mousedown", function (e) {
    if (!ctxMenu.contains(e.target) && !ctxMenu.classList.contains("hidden")) hideCtx();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideCtx(); });
  cm.on("scroll", hideCtx);
  window.addEventListener("blur", hideCtx);

  function queryAsset(rel) {
    return fetch("/api/asset-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: rel })
    }).then(function (r) { return r.json(); });
  }

  function deleteAssetFile(t, alsoEdit) {
    return queryAsset(t.rel).then(function (info) {
      if (!info || !info.exists) { toast("文件不存在或已删除：" + t.rel, true); return null; }
      var name = t.rel.replace(/^assets\//, "");
      var otherRefs = (info.refs || []).filter(function (p) { return p !== currentPath; });
      var text = "将永久删除 static/" + name + (info.size ? "（" + fmtSize(info.size) + "）" : "") + "，此操作不可恢复。";
      if (otherRefs.length) {
        text += "\n\n注意：除当前文章外，还有 " + otherRefs.length + " 处文章引用它：\n" +
          otherRefs.slice(0, 5).join("\n") + (otherRefs.length > 5 ? "\n…" : "");
      }
      if ((info.trefs || []).length) {
        text += "\n\n⚠ 该文件被站点模板引用（" + info.trefs.join("、") + "），删除可能影响站点外观。";
      }
      text += alsoEdit && !t.raw ? "\n\n同时移除该行中的这个引用文本。" : "\n\n引用文本不会自动改动。";
      return askConfirm(text, "删除").then(function (go) {
        if (!go) return null;
        return fetch("/api/assets/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: [t.rel] })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if ((d.failed || []).length) { toast("删除失败：" + d.failed[0].error, true); return null; }
          if (alsoEdit && !t.raw) removeLinkText(t);
          return true;
        });
      });
    }).catch(function (e) { toast("查询失败：" + e, true); return null; });
  }

  function removeLinkText(t) {
    var m = t.match;
    cm.replaceRange("", { line: t.line, ch: m.start }, { line: t.line, ch: m.end });
    var line = cm.getLine(t.line) || "";
    if (line.trim() === "") {
      cm.replaceRange("", { line: t.line, ch: 0 }, { line: t.line + 1, ch: 0 });
    }
  }

  $("#ctxDelBoth").addEventListener("click", function () {
    var t = ctxTarget;
    hideCtx();
    if (!t) return;
    deleteAssetFile(t, true).then(function (ok) {
      if (ok) toast("已删除 static/" + t.rel.replace(/^assets\//, "") + " 并移除该处引用");
    });
  });

  $("#ctxDelFile").addEventListener("click", function () {
    var t = ctxTarget;
    hideCtx();
    if (!t) return;
    deleteAssetFile(t, false).then(function (ok) {
      if (ok) toast("已删除 static/" + t.rel.replace(/^assets\//, "") + "（引用文本未改动）");
    });
  });

  /* ---------------- 杂项 ---------------- */
  $("#refreshBtn").addEventListener("click", function () { loadTree(true); });
  saveBtn.addEventListener("click", saveCurrent);

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  var toastHost = $("#toastHost");
  function toast(msg, isErr) {
    var el = document.createElement("div");
    el.className = "toast" + (isErr ? " error" : "");
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s ease";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 320);
    }, 2400);
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }
  function escAttr(s) { return escHtml(s); }

  /* ---------------- 启动 ---------------- */
  fetch("/api/chroma.css").then(function (r) { return r.text(); }).then(function (css) {
    chromaCSS = css;
    renderPreview();
  }).catch(function () { /* 预览仍可无高亮工作 */ });

  loadTree(false).then(function () {
    var p = new URLSearchParams(location.search).get("path");
    if (p) openFile(p);
  });

  previewEl.srcdoc = emptyDoc();
})();
