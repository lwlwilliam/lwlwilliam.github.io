/**
 * 网页版输入法核心逻辑
 * 支持五笔等基于编码的输入法
 */
class WebInputMethod {
    constructor() {
        // 字典数据: Map<编码, 候选词数组>
        this.dict = new Map();
        // 所有编码集合，用于前缀匹配
        this.allCodes = new Set();
        // 拼音映射: Map<拼音, 汉字数组>
        this.pinyinMap = new Map();
        // 反向索引: Map<汉字, 编码数组>（用于拼音反查显示编码）
        this.reverseDict = new Map();

        // 状态
        this.enabled = true;       // 默认开启中文输入模式
        this.code = '';            // 当前编码
        this.page = 0;             // 当前页码
        this.pageSize = 3;         // 每页候选数
        this.candidates = [];      // 当前候选列表
        this.followCaret = true;   // 候选框是否跟随光标
        this.autoCommit = true;    // 四码唯一是否自动上屏
        this.showCodeHint = true;  // 是否显示编码提示

        // 中英文标点映射表
        this.punctuationMap = {
            ',': '，',
            '.': '。',
            '?': '？',
            '!': '！',
            ':': '：',
            ';': '；',
            '(': '（',
            ')': '）',
            '[': '【',
            ']': '】',
            '{': '｛',
            '}': '｝',
            '<': '《',
            '>': '》',
            '\\': '、',
            '^': '……',
            '~': '～',
            '`': '·',
            '@': '＠',
            '#': '＃',
            '$': '＄',
            '%': '％',
            '&': '＆',
            '*': '＊',
            '_': '——',
            "'": '＇',
            '"': '＂',
            '=': '＝',
            '+': '＋',
            '-': '－',
            '|': '｜'
        };

        // DOM 元素
        this.inputArea = document.getElementById('input-area');
        this.candidateBox = document.getElementById('candidate-box');
        this.codeDisplay = document.getElementById('code-display');
        this.pageInfo = document.getElementById('page-info');
        this.candidateList = document.getElementById('candidate-list');
        this.pageSizeInput = document.getElementById('page-size');
        this.toggleBtn = document.getElementById('toggle-im');
        this.statusSpan = document.getElementById('im-status');
        this.followCaretCheckbox = document.getElementById('follow-caret');
        this.autoCommitCheckbox = document.getElementById('auto-commit');
        this.codeHintCheckbox = document.getElementById('show-code-hint');
        this.vkContainer = document.getElementById('virtual-keyboard');

        this.init();
    }
    
    async init() {
        await this.loadDict();
        await this.loadPinyin();
        this.buildReverseDict();
        this.bindEvents();
        this.initVirtualKeyboard();
        this.initMobilePanel();
        this.updateStatus();
    }
    
    /**
     * 加载字典文件到内存
     */
    async loadDict() {
        try {
            const response = await fetch('dict.txt');
            const text = await response.text();
            this.parseDict(text);
            console.log(`字典加载完成，共 ${this.dict.size} 个编码`);
        } catch (err) {
            console.error('加载字典失败:', err);
            this.inputArea.placeholder = '加载字典失败，请刷新页面重试';
        }
    }
    
    /**
     * 解析字典文本
     * 格式: 编码 [空格/tab] 候选词1 [空格/tab] 候选词2 ...
     * 支持行首有序号（如 "1: a 工"）
     */
    parseDict(text) {
        const lines = text.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // 移除行首序号（如 "1: " 或 "1. "）
            let content = trimmed;
            const prefixMatch = trimmed.match(/^\d+[\.:]\s*(.+)$/);
            if (prefixMatch) {
                content = prefixMatch[1];
            }
            
            // 按空格或 tab 分割
            const parts = content.split(/[\s\t]+/);
            if (parts.length < 2) continue;
            
            const code = parts[0].toLowerCase();
            const words = parts.slice(1).filter(w => w.length > 0);
            
            if (code && words.length > 0) {
                this.allCodes.add(code);
                if (!this.dict.has(code)) {
                    this.dict.set(code, []);
                }
                // 去重添加
                for (const word of words) {
                    const existing = this.dict.get(code);
                    if (!existing.includes(word)) {
                        existing.push(word);
                    }
                }
            }
        }
    }
    
    /**
     * 加载拼音字典
     */
    async loadPinyin() {
        try {
            const response = await fetch('pinyin.txt');
            const text = await response.text();
            this.parsePinyin(text);
            console.log(`拼音表加载完成，共 ${this.pinyinMap.size} 个拼音`);
        } catch (err) {
            console.error('加载拼音表失败:', err);
        }
    }

    /**
     * 解析拼音表文本
     * 格式: 拼音 汉字串（无空格分隔）
     * 例: ni 你您拟...
     */
    parsePinyin(text) {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // 移除行首序号
            let content = trimmed;
            const prefixMatch = trimmed.match(/^\d+[\.:]\s*(.+)$/);
            if (prefixMatch) {
                content = prefixMatch[1];
            }

            const parts = content.split(/[\s\t]+/);
            if (parts.length < 2) continue;

            const py = parts[0].toLowerCase();
            // 第二个部分是连续汉字，按单个字符拆开
            const chars = parts[1].split('').filter(c => c.length > 0);
            if (py && chars.length > 0) {
                this.pinyinMap.set(py, chars);
            }
        }
    }

    /**
     * 根据 dict 构建汉字 -> 编码列表的反向索引
     */
    buildReverseDict() {
        for (const [code, words] of this.dict) {
            for (const word of words) {
                // word 可能是单字或多字词，只对单字建立反向索引
                if (word.length === 1) {
                    if (!this.reverseDict.has(word)) {
                        this.reverseDict.set(word, []);
                    }
                    const arr = this.reverseDict.get(word);
                    if (!arr.includes(code)) {
                        arr.push(code);
                    }
                }
            }
        }
        // 对每个汉字的编码列表按长度排序（短码在前）
        for (const [word, codes] of this.reverseDict) {
            codes.sort((a, b) => a.length - b.length);
        }
        console.log(`反向索引构建完成，共 ${this.reverseDict.size} 个单字`);
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 键盘事件
        this.inputArea.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // 光标移动时更新候选框位置
        this.inputArea.addEventListener('input', () => this.updateCandidatePosition());
        this.inputArea.addEventListener('click', () => this.updateCandidatePosition());
        this.inputArea.addEventListener('keyup', () => this.updateCandidatePosition());

        // 切换输入法按钮
        this.toggleBtn.addEventListener('click', () => this.toggle());

        // 每页候选数变更
        this.pageSizeInput.addEventListener('change', () => {
            const val = parseInt(this.pageSizeInput.value);
            if (val >= 1 && val <= 9) {
                this.pageSize = val;
                this.page = 0;
                if (this.code) {
                    this.updateCandidates();
                }
            }
        });

        // 候选框跟随光标开关
        this.followCaretCheckbox.addEventListener('change', () => {
            this.followCaret = this.followCaretCheckbox.checked;
            this.updateCandidatePosition();
        });

        // 四码唯一自动上屏开关
        this.autoCommitCheckbox.addEventListener('change', () => {
            this.autoCommit = this.autoCommitCheckbox.checked;
        });

        // 编码提示开关
        this.codeHintCheckbox.addEventListener('change', () => {
            this.showCodeHint = this.codeHintCheckbox.checked;
            if (this.code) {
                this.renderCandidates();
            }
        });

        // 点击候选词
        this.candidateList.addEventListener('click', (e) => {
            const item = e.target.closest('.candidate-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.selectCandidate(index);
            }
        });

        // 点击页面空白处时清除编码（点击输入框或候选框除外）
        document.addEventListener('click', (e) => {
            if (this.code.length > 0 &&
                !this.inputArea.contains(e.target) &&
                !this.candidateBox.contains(e.target)) {
                this.reset();
            }
        });

        // 窗口大小改变时更新位置
        window.addEventListener('resize', () => this.updateCandidatePosition());
        window.addEventListener('scroll', () => this.updateCandidatePosition(), true);
    }

    /**
     * 移动端：创建固定底部面板，把候选框和键盘放进去
     */
    initMobilePanel() {
        const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        if (!isMobile || !this.vkContainer) return;

        const panel = document.createElement('div');
        panel.id = 'mobile-input-panel';

        // 把候选框和键盘移入面板
        if (this.candidateBox && this.candidateBox.parentNode) {
            this.candidateBox.parentNode.removeChild(this.candidateBox);
        }
        if (this.vkContainer && this.vkContainer.parentNode) {
            this.vkContainer.parentNode.removeChild(this.vkContainer);
        }

        panel.appendChild(this.candidateBox);
        panel.appendChild(this.vkContainer);
        document.body.appendChild(panel);
    }

    /**
     * 初始化虚拟键盘
     */
    initVirtualKeyboard() {
        if (!this.vkContainer) return;

        const rows = [
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            ['z', 'x', 'c', 'v', 'b', 'n', 'm']
        ];

        // 字母键行
        rows.forEach(rowKeys => {
            const row = document.createElement('div');
            row.className = 'vk-row';
            rowKeys.forEach(key => {
                const btn = this.createVkBtn(key.toUpperCase(), key);
                row.appendChild(btn);
            });
            this.vkContainer.appendChild(row);
        });

        // 功能键行
        const fnRow = document.createElement('div');
        fnRow.className = 'vk-row';

        const toggleBtn = this.createVkBtn('中/英', 'toggle', 'vk-wide vk-fn');
        const prevBtn = this.createVkBtn('←', 'prev', 'vk-fn');
        const spaceBtn = this.createVkBtn('空格', 'space', 'vk-space vk-fn');
        const nextBtn = this.createVkBtn('→', 'next', 'vk-fn');
        const backBtn = this.createVkBtn('⌫', 'backspace', 'vk-wide vk-fn');
        const enterBtn = this.createVkBtn('↵', 'enter', 'vk-wide vk-fn');

        fnRow.appendChild(toggleBtn);
        fnRow.appendChild(prevBtn);
        fnRow.appendChild(spaceBtn);
        fnRow.appendChild(nextBtn);
        fnRow.appendChild(backBtn);
        fnRow.appendChild(enterBtn);
        this.vkContainer.appendChild(fnRow);
    }

    /**
     * 创建虚拟键盘按钮
     */
    createVkBtn(label, key, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = `vk-btn ${extraClass}`;
        btn.textContent = label;
        btn.type = 'button';

        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleVirtualKey(key);
        };

        // 移动端 touchstart，PC 端 mousedown，避免 click 延迟或重复触发
        btn.addEventListener('touchstart', handler, { passive: false });
        btn.addEventListener('mousedown', handler);
        return btn;
    }

    /**
     * 处理虚拟键盘按键
     */
    handleVirtualKey(key) {
        if (!this.enabled) {
            // 英文模式下，字母直接插入，功能键特殊处理
            if (/^[a-z]$/.test(key)) {
                this.insertText(key);
                return;
            }
            if (key === 'space') {
                this.insertText(' ');
                return;
            }
            if (key === 'enter') {
                this.insertText('\n');
                return;
            }
            if (key === 'backspace') {
                this.handleBackspaceNative();
                return;
            }
            if (key === 'toggle') {
                this.toggle();
                return;
            }
            return;
        }

        // 中文模式
        if (/^[a-z]$/.test(key)) {
            this.appendCode(key);
            return;
        }

        switch (key) {
            case 'backspace':
                if (this.code.length > 0) {
                    this.backspace();
                } else {
                    this.handleBackspaceNative();
                }
                break;
            case 'space':
                if (this.code.length > 0) {
                    this.selectCandidate(0);
                } else {
                    this.insertText(' ');
                }
                break;
            case 'enter':
                if (this.code.length > 0) {
                    this.reset();
                } else {
                    this.insertText('\n');
                }
                break;
            case 'toggle':
                this.toggle();
                break;
            case 'prev':
                if (this.code.length > 0) {
                    this.prevPage();
                }
                break;
            case 'next':
                if (this.code.length > 0) {
                    this.nextPage();
                }
                break;
        }
    }

    /**
     * 原生退格（删除输入框内容）
     */
    handleBackspaceNative() {
        const el = this.inputArea;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start === end && start > 0) {
            const value = el.value;
            el.value = value.substring(0, start - 1) + value.substring(end);
            el.setSelectionRange(start - 1, start - 1);
        } else if (start !== end) {
            const value = el.value;
            el.value = value.substring(0, start) + value.substring(end);
            el.setSelectionRange(start, start);
        }
        el.focus();
    }
    
    /**
     * 切换输入法开关
     */
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.reset();
        }
        this.updateStatus();
    }
    
    /**
     * 更新状态显示
     */
    updateStatus() {
        if (this.enabled) {
            this.statusSpan.textContent = '中文';
            this.statusSpan.className = 'im-status chinese';
            this.inputArea.placeholder = '输入法已开启，输入编码...';
        } else {
            this.statusSpan.textContent = '英文';
            this.statusSpan.className = 'im-status english';
            this.inputArea.placeholder = '在此输入...点击按钮切换输入法';
        }
    }
    
    /**
     * 处理键盘事件
     */
    handleKeyDown(e) {
        try {
            // 输入法未开启时，不拦截任何键
            if (!this.enabled) return;

            // 有编码输入时，拦截相关按键
            if (this.code.length > 0) {
            // 字母键: 添加到编码（排除 Ctrl/Alt/Meta 组合键）
            if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && /[a-z]/i.test(e.key)) {
                e.preventDefault();
                this.appendCode(e.key.toLowerCase());
                return;
            }
            
            // 数字键 1-9: 选择候选
            if (/^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                this.selectCandidate(index);
                return;
            }
            
            // +/-: 翻页
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                this.nextPage();
                return;
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                this.prevPage();
                return;
            }
            
            // Backspace: 删除编码最后一位
            if (e.key === 'Backspace') {
                e.preventDefault();
                this.backspace();
                return;
            }
            
            // Space: 选择第一个候选
            if (e.key === ' ') {
                e.preventDefault();
                this.selectCandidate(0);
                return;
            }
            
            // Enter: 清除编码
            if (e.key === 'Enter') {
                e.preventDefault();
                this.reset();
                return;
            }

            // 中文标点：有编码时先上屏编码再输出标点（排除已处理的 +/-）
            const cnPunct = this.getChinesePunctuation(e.key);
            if (cnPunct !== null) {
                e.preventDefault();
                this.commitCodeThenPunct(cnPunct);
                return;
            }
        } else {
            // 没有编码时

            // 字母键：开始输入编码（排除 Ctrl/Alt/Meta 组合键）
            if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && /[a-z]/i.test(e.key)) {
                e.preventDefault();
                this.appendCode(e.key.toLowerCase());
                return;
            }

            // 中文标点：无编码时直接输出中文标点
            const cnPunct = this.getChinesePunctuation(e.key);
            if (cnPunct !== null) {
                e.preventDefault();
                this.insertText(cnPunct);
                return;
            }
        }
        } catch (err) {
            console.error('输入法处理出错:', err);
        }
    }
    
    /**
     * 获取中文标点映射
     * @param {string} key — 键盘按键
     * @returns {string|null} — 对应中文标点，无映射返回 null
     */
    getChinesePunctuation(key) {
        // Shift 组合键：先检查 shift 版本
        // 注意：e.key 在 Shift 按下时已经是大写或符号，如 '(' 来自 shift+9
        if (this.punctuationMap.hasOwnProperty(key)) {
            return this.punctuationMap[key];
        }
        return null;
    }

    /**
     * 在光标位置插入文本（不改变输入法状态）
     */
    insertText(text) {
        const el = this.inputArea;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const value = el.value;

        el.value = value.substring(0, start) + text + value.substring(end);
        const newPos = start + text.length;
        el.setSelectionRange(newPos, newPos);
        el.focus();
    }

    /**
     * 有编码时上屏编码并输出标点
     */
    commitCodeThenPunct(punct) {
        // 先上屏当前编码，再插入标点
        const el = this.inputArea;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const value = el.value;

        el.value = value.substring(0, start) + this.code + punct + value.substring(end);
        const newPos = start + this.code.length + punct.length;
        el.setSelectionRange(newPos, newPos);

        this.reset();
        el.focus();
    }

    /**
     * 添加编码字符
     */
    appendCode(char) {
        this.code += char;
        this.page = 0;
        this.updateCandidates();

        // 反查模式（z开头）不自动清空，不自动上屏
        if (this.code.startsWith('z')) {
            return;
        }

        // 如果没有候选，说明编码无效，自动清空
        if (this.candidates.length === 0) {
            this.reset();
            return;
        }

        // 检查四码唯一自动上屏
        if (this.autoCommit && this.code.length === 4) {
            this.checkAutoCommit();
        }
    }
    
    /**
     * 检查四码唯一并自动上屏
     */
    checkAutoCommit() {
        const exact = this.dict.get(this.code);
        if (exact && exact.length === 1) {
            // 四码唯一，自动上屏
            setTimeout(() => {
                this.commitText(exact[0]);
            }, 0);
        }
    }
    
    /**
     * 删除编码最后一位
     */
    backspace() {
        if (this.code.length > 0) {
            this.code = this.code.slice(0, -1);
            this.page = 0;
            this.updateCandidates();

            // 反查模式下不自动清空
            if (!this.code.startsWith('z')) {
                // 删除后如果编码不为空但没有候选，说明变成了无效编码，自动清空
                if (this.code.length > 0 && this.candidates.length === 0) {
                    this.reset();
                }
            }
        }
        if (this.code.length === 0) {
            this.hideCandidates();
        }
    }
    
    /**
     * 获取当前编码的候选词列表
     * 策略:
     * 1. 先加入完全匹配的候选
     * 2. 再加入前缀匹配的候选（编码以当前编码开头）
     * 3. 去重：同一个词只保留编码最短的那个
     *
     * 反查模式（z开头）:
     * 提取 z 后的拼音，从 pinyinMap 查找汉字，再通过 reverseDict 取编码
     */
    getCandidates() {
        // 反查模式
        if (this.code.startsWith('z')) {
            const py = this.code.slice(1);
            const result = [];
            const chars = this.pinyinMap.get(py);
            if (!chars) return result;

            for (const ch of chars) {
                const codes = this.reverseDict.get(ch);
                if (codes && codes.length > 0) {
                    // 取最短编码用于显示
                    result.push({ word: ch, code: codes[0], isExact: true });
                }
            }
            return result;
        }

        const result = [];
        const seen = new Map(); // word -> { code, isExact }

        // 1. 完全匹配
        const exact = this.dict.get(this.code);
        if (exact) {
            for (const word of exact) {
                if (!seen.has(word) || seen.get(word).code.length > this.code.length) {
                    seen.set(word, { code: this.code, isExact: true });
                }
            }
        }

        // 2. 前缀匹配
        for (const code of this.allCodes) {
            if (code.startsWith(this.code) && code !== this.code) {
                const words = this.dict.get(code);
                for (const word of words) {
                    if (!seen.has(word) || seen.get(word).code.length > code.length) {
                        // 如果已有完全匹配，不覆盖（完全匹配优先）
                        if (!seen.has(word) || !seen.get(word).isExact) {
                            seen.set(word, { code, isExact: false });
                        }
                    }
                }
            }
        }

        // 转换为数组，完全匹配优先，然后按编码长度排序
        for (const [word, info] of seen) {
            result.push({ word, code: info.code, isExact: info.isExact });
        }

        // 排序：完全匹配优先，然后编码短优先，然后字母顺序
        result.sort((a, b) => {
            if (a.isExact !== b.isExact) return b.isExact - a.isExact;
            if (a.code.length !== b.code.length) return a.code.length - b.code.length;
            return a.code.localeCompare(b.code);
        });

        return result;
    }
    
    /**
     * 更新候选列表
     */
    updateCandidates() {
        this.candidates = this.getCandidates();
        this.renderCandidates();
    }
    
    /**
     * 渲染候选框
     */
    renderCandidates() {
        const isReverse = this.code.startsWith('z');

        // 始终更新编码显示，只要当前有编码输入
        if (this.code.length > 0) {
            if (isReverse) {
                const py = this.code.slice(1) || '';
                this.codeDisplay.textContent = `z→拼音:${py}`;
            } else {
                this.codeDisplay.textContent = this.code;
            }
        }

        if (this.candidates.length === 0) {
            // 反查模式下没有候选时，显示提示而不是直接消失
            if (isReverse && this.code.length > 0) {
                const py = this.code.slice(1);
                this.candidateList.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'candidate-item candidate-hint';
                div.textContent = py.length === 0 ? '请输入拼音反查五笔编码…' : '无匹配拼音';
                this.candidateList.appendChild(div);
                this.candidateBox.classList.remove('hidden');
                this.pageInfo.textContent = '-';
                requestAnimationFrame(() => this.updateCandidatePosition());
            } else {
                this.hideCandidates();
            }
            return;
        }

        const totalPages = Math.ceil(this.candidates.length / this.pageSize);
        if (this.page >= totalPages) this.page = totalPages - 1;
        if (this.page < 0) this.page = 0;

        const start = this.page * this.pageSize;
        const end = Math.min(start + this.pageSize, this.candidates.length);
        const pageCandidates = this.candidates.slice(start, end);

        this.pageInfo.textContent = `${this.page + 1}/${totalPages}`;

        // 渲染候选列表
        this.candidateList.innerHTML = '';
        const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

        // 找出当前页第一个全码匹配的索引（不显示编码提示）
        let firstExactIndex = -1;
        pageCandidates.forEach((item, idx) => {
            if (firstExactIndex === -1 && item.code === this.code) {
                firstExactIndex = idx;
            }
        });

        pageCandidates.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'candidate-item';
            div.dataset.index = idx;

            const isExact = item.isExact;

            if (isReverse) {
                // 反查模式：显示汉字 + 五笔编码
                div.innerHTML = `<span class="candidate-num">${idx + 1}</span>${this.escapeHtml(item.word)}<span class="wubi-code">[${item.code}]</span>`;
            } else {
                // 统一渲染：序号小字 + 候选词文本
                let html = `<span class="candidate-num">${idx + 1}</span>${this.escapeHtml(item.word)}`;
                // 编码提示：全码匹配的第一个不显示，其他显示完整编码
                if (this.showCodeHint && idx !== firstExactIndex) {
                    html += `<span class="wubi-code">(${item.code})</span>`;
                }
                div.innerHTML = html;
                if (isExact) {
                    div.classList.add('exact-match');
                }
            }

            this.candidateList.appendChild(div);
        });

        this.candidateBox.classList.remove('hidden');

        // 更新候选框位置
        requestAnimationFrame(() => this.updateCandidatePosition());
    }

    /**
     * HTML 转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 计算 textarea 光标在视口中的坐标
     */
    getCaretCoordinates() {
        const el = this.inputArea;
        const pos = el.selectionStart;
        const style = window.getComputedStyle(el);
        const elRect = el.getBoundingClientRect();

        // textarea 内容区域的视口坐标（排除 border）
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const borderLeft = parseFloat(style.borderLeftWidth) || 0;
        const borderRight = parseFloat(style.borderRightWidth) || 0;
        const borderBottom = parseFloat(style.borderBottomWidth) || 0;

        const contentRect = {
            top: elRect.top + borderTop,
            left: elRect.left + borderLeft,
            right: elRect.right - borderRight,
            bottom: elRect.bottom - borderBottom,
            width: el.clientWidth,
            height: el.clientHeight
        };

        // 创建镜像 div，排版必须与 textarea 完全一致
        const mirror = document.createElement('div');

        const props = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'letterSpacing', 'textTransform', 'wordSpacing',
            'lineHeight', 'textIndent', 'paddingTop', 'paddingRight',
            'paddingBottom', 'paddingLeft',
            'boxSizing', 'whiteSpace', 'wordWrap', 'wordBreak', 'textAlign'
        ];

        props.forEach(prop => {
            mirror.style[prop] = style[prop];
        });

        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.overflow = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        // 关键：宽度与 textarea 内容区域一致，保证折行位置相同
        mirror.style.width = contentRect.width + 'px';

        // 复制内容到光标位置
        const textBefore = el.value.substring(0, pos);
        const textAfter = el.value.substring(pos);

        const span = document.createElement('span');
        span.textContent = '\u200B';

        mirror.textContent = textBefore;
        mirror.appendChild(span);
        if (textAfter) {
            mirror.appendChild(document.createTextNode(textAfter));
        }

        document.body.appendChild(mirror);
        const spanRect = span.getBoundingClientRect();
        document.body.removeChild(mirror);

        // 判断光标是否在 textarea 可见区域内
        const inViewport = spanRect.top >= contentRect.top &&
                          spanRect.bottom <= contentRect.bottom;

        return {
            x: spanRect.left,
            y: spanRect.top,
            height: spanRect.height,
            contentRect,
            inViewport
        };
    }

    /**
     * 更新候选框位置
     */
    updateCandidatePosition() {
        if (this.candidates.length === 0) return;

        // 触屏设备由 CSS 控制候选框位置（固定在输入框上方）
        if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
            return;
        }

        if (this.followCaret) {
            const caret = this.getCaretCoordinates();
            const boxHeight = this.candidateBox.offsetHeight || 100;
            const boxWidth = this.candidateBox.offsetWidth || 300;
            const gap = 5;
            const cr = caret.contentRect;

            let top, left;

            if (caret.inViewport) {
                // 光标在可见区域内：跟随光标，显示在光标下方
                top = caret.y + caret.height + gap;
                left = caret.x;

                // 下方超出 textarea 底部时，改到光标上方
                if (top + boxHeight > cr.bottom) {
                    top = caret.y - boxHeight - gap;
                }
            } else if (caret.y < cr.top) {
                // 光标在可见区域上方：贴在 textarea 顶部上方
                top = cr.top - boxHeight - gap;
                left = cr.left;
            } else {
                // 光标在可见区域下方：贴在 textarea 底部下方
                top = cr.bottom + gap;
                left = cr.left;
            }

            // 视口边界保护
            if (left + boxWidth > window.innerWidth - gap) {
                left = window.innerWidth - boxWidth - gap;
            }
            if (left < gap) left = gap;
            if (top < gap) top = gap;
            if (top + boxHeight > window.innerHeight - gap) {
                top = window.innerHeight - boxHeight - gap;
            }

            this.candidateBox.style.left = left + 'px';
            this.candidateBox.style.top = top + 'px';
        } else {
            // 固定模式：显示在 textarea 上方
            const rect = this.inputArea.getBoundingClientRect();
            const boxWidth = this.candidateBox.offsetWidth || 300;
            const left = Math.max(5, rect.left + (rect.width - boxWidth) / 2);
            const top = Math.max(5, rect.top - (this.candidateBox.offsetHeight || 100) - 5);

            this.candidateBox.style.left = left + 'px';
            this.candidateBox.style.top = top + 'px';
        }
    }

    /**
     * 隐藏候选框
     */
    hideCandidates() {
        this.candidateBox.classList.add('hidden');
    }
    
    /**
     * 选择候选词
     */
    selectCandidate(index) {
        const start = this.page * this.pageSize;
        const candidate = this.candidates[start + index];
        if (candidate) {
            this.commitText(candidate.word);
        }
    }
    
    /**
     * 下一页
     */
    nextPage() {
        const totalPages = Math.ceil(this.candidates.length / this.pageSize);
        if (this.page < totalPages - 1) {
            this.page++;
            this.renderCandidates();
        }
    }
    
    /**
     * 上一页
     */
    prevPage() {
        if (this.page > 0) {
            this.page--;
            this.renderCandidates();
        }
    }
    
    /**
     * 上屏文本到输入框
     */
    commitText(text) {
        const el = this.inputArea;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const value = el.value;
        
        el.value = value.substring(0, start) + text + value.substring(end);
        const newPos = start + text.length;
        el.setSelectionRange(newPos, newPos);
        
        this.reset();
        el.focus();
    }
    
    /**
     * 上屏编码本身
     */
    /**
     * 重置状态
     */
    reset() {
        this.code = '';
        this.page = 0;
        this.candidates = [];
        this.hideCandidates();
        this.inputArea.focus();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.im = new WebInputMethod();
});
