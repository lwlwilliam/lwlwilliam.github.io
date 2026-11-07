/**
 * Tools page: open standalone tool pages in an in-page tab shell.
 * The regular links remain real links and still work with modifier keys
 * or when JavaScript is unavailable.
 */
(function () {
  'use strict';

  var page = document.getElementById('toolsPage');
  if (!page) return;

  var grid = document.getElementById('toolGrid');
  var tabBar = document.getElementById('toolTabBar');
  var tabScroll = document.getElementById('toolTabScroll');
  var embed = document.getElementById('toolEmbedView');
  var frame = document.getElementById('toolFrame');
  var closeButton = document.querySelector('[data-tool-close]');
  if (!grid || !tabBar || !embed || !frame) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-tool]'));
  var tabs = Array.prototype.slice.call(tabBar.querySelectorAll('[data-tool]'));
  var urls = {};
  var currentTool = '';
  var lastTool = '';

  cards.concat(tabs).forEach(function (element) {
    var name = element.getAttribute('data-tool');
    var url = element.getAttribute('data-href') || element.getAttribute('href');
    if (name && url) urls[name] = url;
  });

  function toolFromHash() {
    var match = window.location.hash.match(/^#tool=(.+)$/);
    if (!match) return '';
    try {
      var name = decodeURIComponent(match[1]);
      return Object.prototype.hasOwnProperty.call(urls, name) ? name : '';
    } catch (error) {
      return '';
    }
  }

  function syncThemeToFrame() {
    if (!frame.contentWindow) return;
    var theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    try {
      frame.contentWindow.postMessage({ type: 'theme', theme: theme }, '*');
    } catch (error) {
      /* The frame may be in the middle of navigating. */
    }
  }

  function render(name) {
    var isOpen = Boolean(name && urls[name]);
    currentTool = isOpen ? name : '';
    if (isOpen) lastTool = name;

    grid.hidden = isOpen;
    tabBar.hidden = !isOpen;
    embed.hidden = !isOpen;
    document.body.classList.toggle('tool-embedded', isOpen);

    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-tool') === currentTool;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    });

    if (!isOpen) {
      frame.removeAttribute('src');
      frame.title = '工具页面';
      return;
    }

    var currentTab = tabs.filter(function (tab) {
      return tab.getAttribute('data-tool') === currentTool;
    })[0];
    frame.title = (currentTab ? currentTab.textContent : '工具') + ' · 工具';

    if (frame.getAttribute('src') !== urls[currentTool]) {
      frame.src = urls[currentTool];
    } else {
      syncThemeToFrame();
    }
  }

  function pushToolState(name) {
    var suffix = name ? '#tool=' + encodeURIComponent(name) : '';
    window.history.pushState({ tool: name || null }, '', window.location.pathname + window.location.search + suffix);
  }

  function openTool(name) {
    if (!name || !urls[name]) return;
    render(name);
    pushToolState(name);
  }

  function closeTool() {
    var previous = lastTool;
    render('');
    pushToolState('');
    var card = cards.filter(function (item) {
      return item.getAttribute('data-tool') === previous;
    })[0];
    if (card) card.focus();
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openTool(card.getAttribute('data-tool'));
    });
  });

  tabs.forEach(function (tab) {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tool');
      if (name && name !== currentTool) openTool(name);
    });
  });

  if (closeButton) closeButton.addEventListener('click', closeTool);

  frame.addEventListener('load', syncThemeToFrame);
  document.addEventListener('themechange', syncThemeToFrame);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && currentTool) closeTool();
  });

  window.addEventListener('popstate', function () {
    render(toolFromHash());
  });

  /* Horizontal drag scrolling for the tab strip. */
  if (tabScroll) {
    var pointerDown = false;
    var dragged = false;
    var startX = 0;
    var startScroll = 0;

    tabScroll.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerDown = true;
      dragged = false;
      startX = event.clientX;
      startScroll = tabScroll.scrollLeft;
    });

    tabScroll.addEventListener('pointermove', function (event) {
      if (!pointerDown) return;
      var delta = event.clientX - startX;
      if (Math.abs(delta) > 4) {
        dragged = true;
        tabScroll.classList.add('dragging');
        tabScroll.scrollLeft = startScroll - delta;
        tabScroll.setPointerCapture && tabScroll.setPointerCapture(event.pointerId);
      }
    });

    function endDrag() {
      pointerDown = false;
      tabScroll.classList.remove('dragging');
    }

    tabScroll.addEventListener('pointerup', endDrag);
    tabScroll.addEventListener('pointercancel', endDrag);
    tabScroll.addEventListener('click', function (event) {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    }, true);
  }

  var initial = toolFromHash();
  if (initial) {
    render(initial);
    window.history.replaceState({ tool: initial }, '', window.location.hash);
  }
}());
