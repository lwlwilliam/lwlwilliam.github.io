function toggleTheme() {
  var body = document.body;
  var current = body.className;
  var next = current === 'dark' ? 'light' : 'dark';
  body.className = next;
  localStorage.setItem('theme', next);
}

function toggleMenu() {
  var nav = document.querySelector('.site-nav');
  var btn = document.querySelector('.btn-hamburger');
  nav.classList.toggle('open');
  btn.textContent = nav.classList.contains('open') ? '✕' : '☰';
}

document.addEventListener('click', function(e) {
  var nav = document.querySelector('.site-nav');
  if (!nav.classList.contains('open')) return;
  if (e.target.closest('.nav-link')) {
    nav.classList.remove('open');
    document.querySelector('.btn-hamburger').textContent = '☰';
    return;
  }
  if (!e.target.closest('.site-nav') && !e.target.closest('.btn-hamburger')) {
    nav.classList.remove('open');
    document.querySelector('.btn-hamburger').textContent = '☰';
  }
});

function toggleSearch() {
  var ov = document.getElementById('searchOverlay');
  var input = document.getElementById('searchInput');
  if (ov.classList.contains('active')) {
    ov.classList.remove('active');
    input.value = '';
    document.getElementById('searchResults').innerHTML = '<div class="search-hint">Enter keywords to search...</div>';
  } else {
    ov.classList.add('active');
    if (!searchData && !searchLoading) {
      loadSearchData();
    }
    input.focus();
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var ov = document.getElementById('searchOverlay');
    if (ov.classList.contains('active')) {
      toggleSearch();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    toggleSearch();
  }
});

document.getElementById('searchOverlay').addEventListener('click', function(e) {
  if (e.target === this) toggleSearch();
});

function resolveSearchUrl(url) {
  if (url.charAt(0) !== '/') return url;
  var searchHref = document.getElementById('search-index-url').href;
  var siteRoot = searchHref.replace(/[^/]*$/, '');
  var sitePath = siteRoot.replace(/^https?:\/\/[^/]+/, '');
  var rel = url;
  if (sitePath !== '/' && sitePath && rel.indexOf(sitePath) === 0) {
    rel = rel.substring(sitePath.length);
  }
  if (rel.charAt(0) === '/') {
    rel = rel.substring(1);
  }
  return siteRoot + rel;
}

var searchData = null;
var searchLoading = false;
var searchCallbacks = [];
var searchDebounceTimer = null;
var searchInput = document.getElementById('searchInput');

if (searchInput) {
  searchInput.addEventListener('input', function() {
    var self = this;
    var query = self.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimer);
    if (!query) {
      document.getElementById('searchResults').innerHTML = '<div class="search-hint">Enter keywords to search...</div>';
      return;
    }
    if (!searchData) {
      document.getElementById('searchResults').innerHTML = '<div class="search-hint search-loading"><span class="search-spinner"></span> 正在加载搜索索引...</div>';
    }
    searchDebounceTimer = setTimeout(function() {
      if (!searchData) {
        if (searchLoading) {
          searchCallbacks.push(function() { doSearch(query); });
        } else {
          loadSearchData(function() { doSearch(query); });
        }
      } else {
        doSearch(query);
      }
    }, 200);
  });
}

function loadSearchData(callback) {
  searchLoading = true;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', document.getElementById('search-index-url').getAttribute('href'), true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      try { searchData = JSON.parse(xhr.responseText); } catch(e) { searchData = []; }
    } else {
      searchData = [];
    }
    var cbs = searchCallbacks;
    searchCallbacks = [];
    searchLoading = false;
    if (callback) callback();
    cbs.forEach(function(cb) { cb(); });
  };
  xhr.onerror = function() {
    searchData = [];
    var cbs = searchCallbacks;
    searchCallbacks = [];
    searchLoading = false;
    if (callback) callback();
    cbs.forEach(function(cb) { cb(); });
  };
  xhr.send();
}

function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function highlightText(text, query) {
  var words = query.split(/\s+/).filter(function(w) { return w.length > 0; });
  var result = escapeHtml(text);
  words.forEach(function(word) {
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(' + escaped + ')', 'gi');
    result = result.replace(re, '<mark>$1</mark>');
  });
  return result;
}

function doSearch(query) {
  var words = query.split(/\s+/).filter(function(w) { return w.length > 0; });
  var results = [];
  searchData.forEach(function(post) {
    var score = 0;
    var title = (post.title || '').toLowerCase();
    var content = (post.content || '').toLowerCase();
    var cats = (post.categories || []).join(' ').toLowerCase();
    var kws = (post.keywords || []).join(' ').toLowerCase();

    words.forEach(function(word) {
      var re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      var titleMatches = (title.match(re) || []).length;
      var contentMatches = (content.match(re) || []).length;
      var catMatches = (cats.match(re) || []).length;
      var kwMatches = (kws.match(re) || []).length;
      score += titleMatches * 10 + contentMatches * 1 + catMatches * 3 + kwMatches * 3;
    });
    if (score > 0) results.push({ post: post, score: score });
  });
  results.sort(function(a, b) { return b.score - a.score; });

  if (results.length === 0) {
    document.getElementById('searchResults').innerHTML = '<div class="search-no-results">No results found for "' + escapeHtml(query) + '"</div>';
    return;
  }

  var html = '';
  results.forEach(function(r) {
    var p = r.post;
    var snippet = '';
    var contentText = p.content || '';
    var lowerContent = contentText.toLowerCase();
    var firstWord = words[0].toLowerCase();
    var idx = lowerContent.indexOf(firstWord);
    if (idx >= 0) {
      var start = Math.max(0, idx - 40);
      snippet = contentText.substring(start, start + 200);
      if (start > 0) snippet = '...' + snippet;
      if (start + 200 < contentText.length) snippet = snippet + '...';
    } else {
      snippet = (p.summary || '').substring(0, 150);
    }
    html += '<div class="search-result-item" onclick="location.href=\'' + escapeHtml(resolveSearchUrl(p.url)) + '\'">';
    html += '<div class="search-result-title">' + highlightText(p.title, query) + '</div>';
    html += '<div class="search-result-meta">' + escapeHtml(p.date) + '</div>';
    html += '<div class="search-result-snippet">' + highlightText(snippet, query) + '</div>';
    html += '</div>';
  });
  document.getElementById('searchResults').innerHTML = html;
}

function jumpToPage() {
  var input = document.getElementById('pageJumpInput');
  var page = parseInt(input.value);
  var base = document.getElementById('pagination-base').getAttribute('href');
  if (isNaN(page) || page < 1) return;

  if (page === 1) {
    location.href = base;
  } else {
    var url = base;
    if (url.endsWith('/')) url = url.slice(0, -1);
    location.href = url + '/page/' + page + '/';
  }
}

document.getElementById('pageJumpInput') && document.getElementById('pageJumpInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') jumpToPage();
});

(function() {
  var toc = document.getElementById('post-toc');
  if (!toc) return;

  var nav = toc.querySelector('nav');
  if (nav) {
    try {
      (function() {
      var changed;
      do {
        changed = false;
        var lis = nav.querySelectorAll('li');
        for (var i = 0; i < lis.length; i++) {
          var li = lis[i];
          if (li.querySelector('a')) continue;
          if (!li.parentNode) continue;
          var childUls = [];
          for (var ci = 0; ci < li.children.length; ci++) {
            if (li.children[ci].tagName === 'UL') {
              childUls.push(li.children[ci]);
            }
          }
          if (childUls.length === 0) continue;
          for (var u = 0; u < childUls.length; u++) {
            while (childUls[u].firstChild) {
              li.parentNode.insertBefore(childUls[u].firstChild, li);
            }
          }
          if (li.parentNode) {
            li.parentNode.removeChild(li);
            changed = true;
          }
        }
      } while (changed);
      })();
    } catch(e) {}
  }

  toc.addEventListener('toggle', function() {
    if (toc.open && 'scrollIntoView' in toc) {
      setTimeout(function() { toc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  });
  document.addEventListener('click', function(e) {
    if (toc.open && !toc.contains(e.target)) {
      toc.open = false;
    }
  });
})();

(function() {
  var nav = document.querySelector('.site-nav');
  var btn = document.querySelector('.btn-hamburger');
  var headerInner = document.querySelector('.header-inner');
  if (!nav || !btn || !headerInner) return;

  function checkOverflow() {
    if (window.innerWidth <= 768) {
      document.body.classList.remove('nav-overflow');
      return;
    }

    document.body.classList.remove('nav-overflow');
    nav.classList.remove('open');
    btn.textContent = '☰';

    var links = nav.querySelectorAll('.nav-link');
    if (!links.length) return;

    var totalWidth = 0;
    links.forEach(function(link) {
      totalWidth += link.getBoundingClientRect().width;
    });

    var style = getComputedStyle(nav);
    var gap = parseFloat(style.gap) || 0;
    totalWidth += (links.length - 1) * gap;

    var available = headerInner.clientWidth
      - headerInner.querySelector('.site-title').getBoundingClientRect().width
      - headerInner.querySelector('.header-actions').getBoundingClientRect().width
      - parseFloat(getComputedStyle(headerInner).gap || 0) * 2;

    if (totalWidth > available) {
      document.body.classList.add('nav-overflow');
    }
  }

  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(checkOverflow, 100);
  });

  checkOverflow();
})();
