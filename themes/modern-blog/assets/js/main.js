// 主题切换功能
class ThemeManager {
  constructor() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.themeIcon = document.getElementById('theme-icon');
    this.init();
  }

  init() {
    // 从localStorage获取主题设置，默认为light
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);
    
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    if (this.themeIcon) {
      this.themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
}

// 搜索功能
class SearchManager {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchResults = document.getElementById('search-results');
    this.searchData = [];
    this.init();
  }

  async init() {
    if (!this.searchInput) return;
    
    // 加载搜索数据
    await this.loadSearchData();
    
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    this.searchInput.addEventListener('focus', () => this.showResults());
    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && !this.searchResults.contains(e.target)) {
        this.hideResults();
      }
    });
  }

  async loadSearchData() {
    try {
      // 尝试从预生成的search.json加载数据
      const response = await fetch('/search.json');
      if (response.ok) {
        this.searchData = await response.json();
      }
    } catch (error) {
      console.warn('Search data not available:', error);
    }
  }

  handleSearch(query) {
    if (!query.trim()) {
      this.searchResults.innerHTML = '';
      this.hideResults();
      return;
    }

    const results = this.searchData.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(query.toLowerCase());
      const contentMatch = item.content?.toLowerCase().includes(query.toLowerCase());
      return titleMatch || contentMatch;
    }).slice(0, 10); // 限制结果数量

    this.displayResults(results, query);
    this.showResults();
  }

  displayResults(results, query) {
    if (results.length === 0) {
      this.searchResults.innerHTML = `
        <div class="search-result-item">
          <div class="search-result-title">未找到结果</div>
          <div class="search-result-excerpt">没有找到包含 "${query}" 的内容</div>
        </div>
      `;
      return;
    }

    this.searchResults.innerHTML = results.map(item => `
      <a href="${item.url}" class="search-result-item">
        <div class="search-result-title">${this.highlightText(item.title, query)}</div>
        <div class="search-result-excerpt">${this.getExcerpt(item.content, query)}</div>
      </a>
    `).join('');
  }

  highlightText(text, query) {
    if (!text || !query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  getExcerpt(content, query, length = 100) {
    if (!content) return '';
    
    const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());
    let excerpt = '';
    
    if (queryIndex > -1) {
      const start = Math.max(0, queryIndex - 50);
      const end = Math.min(content.length, queryIndex + 50);
      excerpt = content.substring(start, end);
      
      if (start > 0) excerpt = '...' + excerpt;
      if (end < content.length) excerpt = excerpt + '...';
    } else {
      excerpt = content.substring(0, length) + (content.length > length ? '...' : '');
    }
    
    return this.highlightText(excerpt, query);
  }

  showResults() {
    if (this.searchResults.innerHTML.trim()) {
      this.searchResults.style.display = 'block';
    }
  }

  hideResults() {
    this.searchResults.style.display = 'none';
  }
}

// 分页功能
class PaginationManager {
  constructor() {
    this.pageInput = document.getElementById('page-input');
    this.init();
  }

  init() {
    if (!this.pageInput) return;
    
    this.pageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.goToPage();
      }
    });
  }

  goToPage() {
    const page = parseInt(this.pageInput.value);
    if (!page || page < 1) return;
    
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('page', page);
    window.location.href = currentUrl.toString();
  }
}

// 工具页面功能
class ToolsManager {
  constructor() {
    this.init();
  }

  init() {
    // 为工具卡片添加点击事件
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('a')) {
          const toolUrl = card.getAttribute('data-tool-url');
          if (toolUrl) {
            window.location.href = toolUrl;
          }
        }
      });
    });
  }
}

// 初始化所有功能
document.addEventListener('DOMContentLoaded', () => {
  // 初始化主题管理器
  new ThemeManager();
  
  // 初始化搜索管理器
  new SearchManager();
  
  // 初始化分页管理器
  new PaginationManager();
  
  // 初始化工具管理器
  new ToolsManager();
  
  // 为代码块添加复制按钮
  addCopyButtonsToCodeBlocks();
  
  // 初始化数学公式渲染
  renderMath();
});

// 为代码块添加复制按钮
function addCopyButtonsToCodeBlocks() {
  document.querySelectorAll('pre code').forEach(codeBlock => {
    const pre = codeBlock.parentElement;
    if (!pre.classList.contains('code-block')) {
      pre.classList.add('code-block');
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.innerHTML = '📋';
      copyButton.title = '复制代码';
      
      copyButton.addEventListener('click', () => {
        const text = codeBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
          copyButton.innerHTML = '✅';
          copyButton.title = '已复制';
          setTimeout(() => {
            copyButton.innerHTML = '📋';
            copyButton.title = '复制代码';
          }, 2000);
        });
      });
      
      pre.style.position = 'relative';
      copyButton.style.position = 'absolute';
      copyButton.style.top = '0.5rem';
      copyButton.style.right = '0.5rem';
      copyButton.style.background = 'var(--card-bg)';
      copyButton.style.border = '1px solid var(--border-color)';
      copyButton.style.borderRadius = '4px';
      copyButton.style.padding = '0.25rem 0.5rem';
      copyButton.style.cursor = 'pointer';
      copyButton.style.fontSize = '0.8rem';
      
      pre.appendChild(copyButton);
    }
  });
}

// 渲染数学公式
function renderMath() {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ]
    });
  }
}

// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// 图片懒加载
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        imageObserver.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}