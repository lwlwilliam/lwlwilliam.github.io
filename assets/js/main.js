/**
 * Site behaviour, grouped by page feature.
 * Loaded with defer on every page; each initializer exits when its
 * target elements are absent.
 */
(function () {
  'use strict';

  var documentRoot = document.documentElement;
  var THEME_KEY = 'theme';

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Theme ---------- */
  function currentTheme() {
    return documentRoot.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    theme = theme === 'dark' ? 'dark' : 'light';
    documentRoot.dataset.theme = theme;
    documentRoot.style.colorScheme = theme;

    var meta = $('meta[data-theme-color]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0f1115' : '#f7f8fa');
    }

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        /* Storage can be unavailable in private or embedded contexts. */
      }
    }

    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  function initTheme() {
    applyTheme(currentTheme(), false);

    var toggle = $('[data-theme-toggle]');
    if (toggle) {
      function syncThemeLabel(theme) {
        var label = theme === 'dark' ? '切换为浅色主题' : '切换为深色主题';
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
      }
      syncThemeLabel(currentTheme());
      toggle.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
        syncThemeLabel(next);
      });
      document.addEventListener('themechange', function (event) {
        syncThemeLabel(event.detail.theme);
      });
    }

    window.addEventListener('storage', function (event) {
      if (event.key === THEME_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
        applyTheme(event.newValue, false);
      }
    });
  }

  /* ---------- Mobile navigation ---------- */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var nav = $('#siteNav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('.nav-link')) setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('open')) return;
      if (event.target.closest('#siteNav') || event.target.closest('[data-menu-toggle]')) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    if (window.matchMedia) {
      var desktop = window.matchMedia('(min-width: 901px)');
      var handleBreakpoint = function (event) {
        if (event.matches) setOpen(false);
      };
      if (desktop.addEventListener) desktop.addEventListener('change', handleBreakpoint);
      else if (desktop.addListener) desktop.addListener(handleBreakpoint);
    }
  }

  /* ---------- Search ---------- */
  function initSearch() {
    var overlay = $('#searchOverlay');
    var input = $('#searchInput');
    var results = $('#searchResults');
    var indexLink = $('#search-index-url');
    if (!overlay || !input || !results || !indexLink) return;

    var searchData = null;
    var searchRequest = null;
    var debounceTimer = null;
    var requestVersion = 0;
    var opener = null;

    function emptyResults() {
      results.innerHTML = '<p class="search-hint">输入关键词搜索文章</p>';
    }

    function setOpen(open) {
      overlay.classList.toggle('active', open);
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      $all('[data-search-toggle]').forEach(function (button) {
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.body.style.overflow = open ? 'hidden' : '';

      if (open) {
        opener = document.activeElement;
        input.focus();
        if (!searchData) loadSearchData().then(function () {
          if (overlay.classList.contains('active')) input.focus();
        });
      } else {
        input.value = '';
        emptyResults();
        if (opener && typeof opener.focus === 'function') opener.focus();
        opener = null;
      }
    }

    function loadSearchData() {
      if (searchData) return Promise.resolve(searchData);
      if (searchRequest) return searchRequest;

      searchRequest = fetch(indexLink.href, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Search index request failed');
          return response.json();
        })
        .catch(function () {
          return [];
        })
        .then(function (data) {
          searchData = Array.isArray(data) ? data : [];
          searchRequest = null;
          return searchData;
        });

      return searchRequest;
    }

    function resolveSearchUrl(url) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url;
      var root = new URL('.', indexLink.href);
      return new URL(String(url).replace(/^\/+/, ''), root).href;
    }

    function appendHighlighted(container, text, words) {
      if (!words.length) {
        container.textContent = text;
        return;
      }

      var pattern = new RegExp('(' + words.map(escapeRegExp).join('|') + ')', 'gi');
      var cursor = 0;
      var match;

      while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) {
          container.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        }
        var mark = document.createElement('mark');
        mark.textContent = match[0];
        container.appendChild(mark);
        cursor = pattern.lastIndex;
        if (match[0].length === 0) pattern.lastIndex += 1;
      }

      if (cursor < text.length) {
        container.appendChild(document.createTextNode(text.slice(cursor)));
      }
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildSnippet(content, words) {
      var text = String(content || '');
      var lower = text.toLowerCase();
      var first = words[0] || '';
      var index = lower.indexOf(first);

      if (index < 0) return text.slice(0, 160);
      var start = Math.max(0, index - 55);
      var snippet = text.slice(start, start + 190);
      return (start > 0 ? '…' : '') + snippet + (start + 190 < text.length ? '…' : '');
    }

    function renderResults(query) {
      var words = query.toLowerCase().split(/\s+/).filter(Boolean);
      var ranked = [];

      searchData.forEach(function (post) {
        var title = String(post.title || '').toLowerCase();
        var content = String(post.content || '').toLowerCase();
        var categories = (post.categories || []).join(' ').toLowerCase();
        var keywords = (post.keywords || []).join(' ').toLowerCase();
        var score = 0;

        words.forEach(function (word) {
          var pattern = new RegExp(escapeRegExp(word), 'g');
          score += (title.match(pattern) || []).length * 10;
          score += (content.match(pattern) || []).length;
          score += (categories.match(pattern) || []).length * 3;
          score += (keywords.match(pattern) || []).length * 3;
        });

        if (score > 0) ranked.push({ post: post, score: score });
      });

      ranked.sort(function (a, b) { return b.score - a.score; });
      results.textContent = '';

      if (!ranked.length) {
        var empty = document.createElement('p');
        empty.className = 'search-no-results';
        empty.textContent = '没有找到与“' + query + '”相关的文章';
        results.appendChild(empty);
        return;
      }

      var fragment = document.createDocumentFragment();
      ranked.slice(0, 40).forEach(function (entry) {
        var post = entry.post;
        var link = document.createElement('a');
        link.className = 'search-result-item';
        link.href = resolveSearchUrl(post.url || '#');

        var title = document.createElement('div');
        title.className = 'search-result-title';
        appendHighlighted(title, String(post.title || ''), words);

        var meta = document.createElement('div');
        meta.className = 'search-result-meta';
        meta.textContent = post.date || '';

        var snippet = document.createElement('div');
        snippet.className = 'search-result-snippet';
        appendHighlighted(snippet, buildSnippet(post.content, words), words);

        link.appendChild(title);
        link.appendChild(meta);
        link.appendChild(snippet);
        fragment.appendChild(link);
      });

      results.appendChild(fragment);
    }

    function search(query) {
      var version = ++requestVersion;
      results.innerHTML = '<p class="search-hint search-loading"><span class="search-spinner"></span>正在加载搜索索引…</p>';

      loadSearchData().then(function () {
        if (version !== requestVersion || !overlay.classList.contains('active')) return;
        renderResults(query);
      });
    }

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var query = input.value.trim();

      if (!query) {
        requestVersion += 1;
        emptyResults();
        return;
      }

      debounceTimer = window.setTimeout(function () {
        search(query);
      }, 180);
    });

    $all('[data-search-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        setOpen(!overlay.classList.contains('active'));
      });
    });

    $all('[data-search-close]').forEach(function (button) {
      button.addEventListener('click', function () { setOpen(false); });
    });

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!overlay.classList.contains('active'));
        return;
      }

      if (!overlay.classList.contains('active')) return;

      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        var focusable = $all('a[href], button:not([disabled]), input:not([disabled])', overlay)
          .filter(function (element) { return element.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* ---------- Whole-card navigation ---------- */
  function initCardLinks() {
    document.addEventListener('click', function (event) {
      var row = event.target.closest && event.target.closest('.post-card, .archive-item');
      if (!row) return;
      if (event.target.closest('a, button, input, select, textarea, label')) return;

      var link = row.classList.contains('archive-item')
        ? row.querySelector('a[href]:not(.category-pill-sm)')
        : row.querySelector('.post-card-title a, .post-card-readmore');
      if (!link) return;

      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        window.open(link.href, '_blank', 'noopener');
      } else {
        window.location.assign(link.href);
      }
    });
  }

  /* ---------- Back to top ---------- */
  function initBackToTop() {
    var button = $('[data-back-to-top]');
    if (!button) return;
    var scheduled = false;

    function update() {
      button.classList.toggle('visible', window.scrollY > 420);
      scheduled = false;
    }

    window.addEventListener('scroll', function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    update();
  }

  /* ---------- Lazy images and videos ---------- */
  function initMedia() {
    $all('.img-lazy').forEach(function (image) {
      var figure = image.closest('.img-figure');

      function markLoaded() {
        image.classList.add('loaded');
      }

      function markError() {
        image.classList.add('loaded');
        if (figure) figure.classList.add('is-error');
      }

      if (image.complete) {
        if (image.naturalWidth > 0) markLoaded();
        else markError();
        return;
      }

      image.addEventListener('load', markLoaded, { once: true });
      image.addEventListener('error', markError, { once: true });
    });

    var videos = $all('.post-content video');
    if (!videos.length) return;

    function loadVideo(video) {
      video.setAttribute('preload', 'metadata');
      $all('source[data-src]', video).forEach(function (source) {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
      });
    }

    if (!('IntersectionObserver' in window)) {
      videos.forEach(loadVideo);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadVideo(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '400px 0px' });

    videos.forEach(function (video) {
      if (!video.hasAttribute('preload') || video.getAttribute('preload') === 'auto') {
        video.setAttribute('preload', 'none');
      }
      observer.observe(video);
    });
  }

  /* ---------- Scrollable data tables ---------- */
  function initTables() {
    $all('.post-content table').forEach(function (table) {
      if (!table.parentNode || table.parentNode.classList.contains('table-scroll')) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', '可横向滚动的数据表格');
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  /* ---------- Copy code ---------- */
  function initCodeCopy() {
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'));
        } catch (error) {
          reject(error);
        } finally {
          textarea.remove();
        }
      });
    }

    $all('.post-content pre').forEach(function (pre) {
      var container = pre.closest('.highlight');
      if (container) {
        container.classList.add('code-block');
      } else {
        container = pre.parentElement;
        container.classList.add('code-block');
      }

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-copy';
      button.textContent = '复制';
      button.title = '复制代码';
      button.setAttribute('aria-label', '复制代码');

      button.addEventListener('click', function () {
        var code = pre.querySelector('code');
        var text = code ? code.textContent : pre.textContent;
        copyText(text).then(function () {
          button.textContent = '已复制';
          window.setTimeout(function () { button.textContent = '复制'; }, 1800);
        }).catch(function () {
          button.textContent = '复制失败';
          window.setTimeout(function () { button.textContent = '复制'; }, 1800);
        });
      });

      container.appendChild(button);
    });
  }

  /* ---------- Article table of contents ---------- */
  function initArticleToc() {
    var toc = $('#post-toc');
    var content = $('.post-content');
    if (!toc || !content) return;

    var links = $all('a[href^="#"]', toc);
    if (!links.length) return;

    var linkTargets = links.map(function (link) {
      var raw = link.getAttribute('href').slice(1);
      var id;
      try { id = decodeURIComponent(raw); } catch (error) { id = raw; }
      return { link: link, heading: document.getElementById(id) };
    }).filter(function (item) { return item.heading; });

    var scheduled = false;
    function updateActive() {
      var threshold = 86;
      var active = null;

      linkTargets.forEach(function (item) {
        if (item.heading.getBoundingClientRect().top <= threshold) active = item;
      });

      links.forEach(function (link) {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      });

      if (active) {
        active.link.classList.add('active');
        active.link.setAttribute('aria-current', 'location');
      }
      scheduled = false;
    }

    function scheduleUpdate() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(updateActive);
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    updateActive();

    document.addEventListener('click', function (event) {
      if (toc.open && !toc.contains(event.target)) toc.open = false;
    });

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
          toc.open = false;
        }
      });
    });
  }

  /* ---------- Archive / books year navigation ---------- */
  function initYearNavigation() {
    $all('[data-year-toc]').forEach(function (toc) {
      var links = $all('.year-toc-link', toc);
      var items = links.map(function (link) {
        var href = link.getAttribute('href') || '';
        return { link: link, section: href.charAt(0) === '#' ? document.getElementById(href.slice(1)) : null };
      }).filter(function (item) { return item.section; });

      if (items.length) {
        var scheduled = false;
        var update = function () {
          var active = items[0];
          items.forEach(function (item) {
            if (item.section.getBoundingClientRect().top <= 96) active = item;
          });
          links.forEach(function (link) { link.classList.remove('active'); });
          if (active) active.link.classList.add('active');
          scheduled = false;
        };
        var schedule = function () {
          if (scheduled) return;
          scheduled = true;
          window.requestAnimationFrame(update);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        update();
      }

      document.addEventListener('click', function (event) {
        if (toc.open && !toc.contains(event.target)) toc.open = false;
      });

      links.forEach(function (link) {
        link.addEventListener('click', function () {
          window.setTimeout(function () { toc.open = false; }, 160);
        });
      });
    });
  }

  /* ---------- Pagination jump ---------- */
  function initPagination() {
    var form = $('[data-pagination-form]');
    var urlsNode = $('#pagination-urls');
    if (!form || !urlsNode) return;
    var input = $('#pageJumpInput', form);
    var urls = $all('a[href]', urlsNode).map(function (link) {
      return link.getAttribute('href');
    });
    if (!urls.length) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var page = parseInt(input.value, 10);

      if (!Number.isFinite(page) || page < 1 || page > urls.length) {
        input.focus();
        return;
      }

      window.location.assign(urls[page - 1]);
    });
  }

  function init() {
    initTheme();
    initMenu();
    initSearch();
    initCardLinks();
    initBackToTop();
    initMedia();
    initTables();
    initCodeCopy();
    initArticleToc();
    initYearNavigation();
    initPagination();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
