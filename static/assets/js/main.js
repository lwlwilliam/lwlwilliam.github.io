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
  if (nav.classList.contains('open') && e.target.closest('.nav-link')) {
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
  xhr.open('GET', '/search.json', true);
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
    html += '<div class="search-result-item" onclick="location.href=\'' + escapeHtml(p.url) + '\'">';
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
  var base = input.getAttribute('data-base');
  if (isNaN(page) || page < 1) return;

  if (page === 1) {
    location.href = base;
  } else {
    var parts = base.split('/');
    var url = base;
    if (url.endsWith('/')) url = url.slice(0, -1);
    location.href = url + '/page/' + page + '/';
  }
}

document.getElementById('pageJumpInput') && document.getElementById('pageJumpInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') jumpToPage();
});
