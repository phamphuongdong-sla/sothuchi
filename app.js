/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Main Application Entry & Infrastructure
   ========================================================================== */

/**
 * Register PWA Service Worker (non-blocking)
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (worker) {
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available. Refresh to update.');
              }
            });
          }
        });
      })
      .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}

/**
 * Query multiple CSS selectors, returning unique matched elements.
 * @param {string[]} selectors
 * @returns {Element[]}
 */
function querySelectorAllMultiple(selectors) {
  const set = new Set();
  selectors.forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach(el => set.add(el));
    } catch (_) {}
  });
  return Array.from(set);
}

/**
 * Get a module from window by preferred name order.
 * @param {...string} names
 * @returns {*}
 */
function getModule(...names) {
  for (const name of names) {
    if (window[name]) return window[name];
  }
  return null;
}

/* --------------------------------------------------------------------------
   Theme Engine
   Manages light/dark theme, persistence, system sync, and toggle UI.
   -------------------------------------------------------------------------- */
const ThemeEngine = {
  STORAGE_KEY: 'theme',

  getPreferredTheme() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  setTheme(theme, persist = false) {
    const valid = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', valid);

    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', valid === 'dark' ? '#0f172a' : '#4f46e5');

    if (persist) {
      try { localStorage.setItem(this.STORAGE_KEY, valid); } catch (_) {}
    }

    this._updateToggleUI(valid);
    window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: valid } }));
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || this.getPreferredTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark', true);
  },

  _updateToggleUI(theme) {
    querySelectorAllMultiple(['#theme-toggle', '[data-action="toggle-theme"]']).forEach(btn => {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
      const icon = btn.querySelector('.theme-icon');
      if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    });
  },

  init() {
    this.setTheme(this.getPreferredTheme(), false);

    // Sync with OS preference if user hasn't saved a preference
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mq) {
      const handler = e => {
        try {
          if (!localStorage.getItem(this.STORAGE_KEY)) {
            this.setTheme(e.matches ? 'dark' : 'light', false);
          }
        } catch (_) {}
      };
      mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    }

    document.addEventListener('click', e => {
      const target = e.target?.closest('#theme-toggle, [data-action="toggle-theme"]');
      if (target) {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }
};

/* --------------------------------------------------------------------------
   SPA Router
   Hash-based router: #transactions | #budget | #reports | #settings
   -------------------------------------------------------------------------- */
const Router = {
  DEFAULT_ROUTE: 'transactions',
  ROUTES: ['transactions', 'budget', 'reports', 'networth', 'settings'],
  TITLES: {
    transactions: 'Giao dịch',
    budget: 'Ngân sách',
    reports: 'Báo cáo',
    networth: 'Tài sản ròng',
    settings: 'Cài đặt'
  },
  hooks: {},

  getCurrentRoute() {
    const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return this.ROUTES.includes(hash) ? hash : this.DEFAULT_ROUTE;
  },

  navigateTo(route) {
    window.location.hash = `#${this.ROUTES.includes(route) ? route : this.DEFAULT_ROUTE}`;
  },

  render() {
    const active = this.getCurrentRoute();

    const viewTitle = document.getElementById('view-title');
    if (viewTitle) {
      const map = this?.TITLE_MAP || { transactions: 'Giao dịch', budget: 'Ngân sách', reports: 'Báo cáo', settings: 'Cài đặt' };
      viewTitle.textContent = map[active] || 'Giao dịch';
    }

    // Update view panels
    querySelectorAllMultiple(['.view-panel', '[data-view-content]', '[data-route]']).forEach(panel => {
      const route = panel.getAttribute('data-route') ||
                    panel.getAttribute('data-view-content') ||
                    panel.id?.replace(/^view-/, '') || '';
      if (route === active) {
        panel.classList.add('active');
        panel.removeAttribute('hidden');
        if (panel.style) panel.style.display = 'block';
      } else {
        panel.classList.remove('active');
        panel.setAttribute('hidden', '');
        if (panel.style) panel.style.display = 'none';
      }
    });

    // Update nav links
    querySelectorAllMultiple(['.nav-link', '[data-view]', '[role="tab"]']).forEach(link => {
      const route = (typeof link.getAttribute === 'function' && link.getAttribute('data-view')) ||
                    (typeof link.getAttribute === 'function' && link.getAttribute('href')?.replace(/^#\/?/, '').trim()) ||
                    (link.id && link.id.replace(/^nav-/, '')) || '';
      const isActive = route === active;
      if (link && link.classList) {
        if (typeof link.classList.toggle === 'function') {
          link.classList.toggle('active', isActive);
        } else if (isActive && typeof link.classList.add === 'function') {
          link.classList.add('active');
        } else if (!isActive && typeof link.classList.remove === 'function') {
          link.classList.remove('active');
        }
      }
      if (link && typeof link.setAttribute === 'function') {
        link.setAttribute('aria-selected', String(isActive));
      }
    });

    window.dispatchEvent(new CustomEvent('routechanged', { detail: { route: active } }));

    if (typeof this.hooks[active] === 'function') {
      try { this.hooks[active](); } catch (err) {
        console.error(`[Router] Hook error for '${active}':`, err);
      }
    }
  },

  on(route, callback) {
    if (this.ROUTES.includes(route) && typeof callback === 'function') {
      this.hooks[route] = callback;
    }
  },

  init() {
    if (!window.location.hash) {
      window.history?.replaceState
        ? window.history.replaceState(null, '', `#${this.DEFAULT_ROUTE}`)
        : (window.location.hash = `#${this.DEFAULT_ROUTE}`);
    }
    window.addEventListener('hashchange', () => this.render());
    this.render();
  }
};

/* --------------------------------------------------------------------------
   Toast Notification System
   -------------------------------------------------------------------------- */
const Toast = {
  show(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body?.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.parentNode?.removeChild(toast), 300);
    }, duration);
  }
};

/* --------------------------------------------------------------------------
   Currency Helpers
   -------------------------------------------------------------------------- */
function parseRawAmount(inputStr) {
  if (inputStr == null) return 0;
  const cleaned = String(inputStr).replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function formatVNDInput(value) {
  const numeric = parseRawAmount(value);
  if (!numeric || isNaN(numeric)) return '';
  return numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Convert numeric amount to Vietnamese words
 * @param {number|string} amount 
 * @returns {string} Capitalized words string or empty
 */
function numberToVietnameseWords(amount) {
  const num = typeof amount === 'number' ? amount : (parseRawAmount(amount) || 0);
  if (!num || isNaN(num) || num <= 0) return '';

  const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readThreeDigits(n, showZeroHundreds) {
    let res = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0 || showZeroHundreds) {
      res += units[h] + ' trăm ';
    }

    if (t > 1) {
      res += units[t] + ' mươi ';
      if (u === 1) res += 'mốt';
      else if (u === 4) res += 'tư';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += units[u];
    } else if (t === 1) {
      res += 'mười ';
      if (u === 1) res += 'một';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += units[u];
    } else if (t === 0 && u > 0) {
      if (h > 0 || showZeroHundreds) res += 'lẻ ';
      if (u === 5 && (h > 0 || showZeroHundreds)) res += 'năm';
      else res += units[u];
    }

    return res.trim();
  }

  let str = Math.floor(num).toString();
  const groups = [];
  while (str.length > 0) {
    groups.push(parseInt(str.slice(-3), 10));
    str = str.slice(0, -3);
  }

  const bigNames = ['', 'nghìn', 'triệu', 'tỷ'];
  const words = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const val = groups[i];
    if (val > 0) {
      const showZeroH = i < groups.length - 1;
      const readGroup = readThreeDigits(val, showZeroH);

      const unitIdx = i % 3;
      const tyLevel = Math.floor(i / 3);

      let unitName = bigNames[unitIdx];
      if (i > 0 && unitIdx === 0) {
        unitName = 'tỷ'.repeat(tyLevel);
      } else if (tyLevel > 0 && unitIdx !== 0) {
        unitName += ' ' + 'tỷ'.repeat(tyLevel);
      }

      words.push(`${readGroup} ${unitName}`.trim());
    }
  }

  let resultStr = words.join(' ').replace(/\s+/g, ' ').trim();
  if (!resultStr) return '';

  return resultStr.charAt(0).toUpperCase() + resultStr.slice(1) + ' đồng';
}

/* --------------------------------------------------------------------------
   Transaction Form Handler
   -------------------------------------------------------------------------- */
const TransactionForm = {
  _todayString() {
    return window.formatLocalYMD ? window.formatLocalYMD() : (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();
  },

  getCurrentType() {
    return document.querySelector('input[name="tx-type"]:checked')?.value || 'expense';
  },

  populateCategories(type, forceDefault = false) {
    const selectEl = document.getElementById('input-category');
    if (!selectEl) return;

    const currentValue = selectEl.value;

    type = type || this.getCurrentType();

    const catMgr = getModule('Categories', 'CategoryManager');
    let categories = [];
    if (catMgr?.getActive) {
      categories = catMgr.getActive(type);
    } else {
      categories = (window.DB?.getCategories(false) || []).filter(c => c.type === type);
    }

    const stateKey = JSON.stringify(categories.map(c => c.id + c.name + c.icon + c.group));
    if (selectEl.dataset.renderState === stateKey) {
      if (forceDefault && categories.length) {
        selectEl.value = categories[0].name;
      }
      return;
    }
    selectEl.dataset.renderState = stateKey;

    selectEl.innerHTML = '<option value="" disabled selected>-- Chọn hạng mục --</option>';

    if (!categories.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = 'Chưa có hạng mục nào';
      selectEl.appendChild(opt);
      return;
    }

    const groups = new Map();
    categories.forEach(cat => {
      const g = cat.group || 'Khác';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(cat);
    });

    groups.forEach((list, gName) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = gName;
      list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = `${cat.icon ? cat.icon + ' ' : ''}${cat.name}`;
        optgroup.appendChild(opt);
      });
      selectEl.appendChild(optgroup);
    });

    if (!forceDefault && currentValue && selectEl.querySelector(`option[value="${currentValue}"]`)) {
      selectEl.value = currentValue;
    } else if (categories.length) {
      selectEl.value = categories[0].name;
    }
  },

  populateWallets(forceDefault = false) {
    const db = window.DB;
    if (!db?.getWallets) return;
    const wallets = db.getWallets();

    const targets = [
      document.getElementById('input-wallet'),
      document.getElementById('filter-wallet'),
      document.getElementById('filter-report-wallet'),
      document.getElementById('transfer-from-wallet'),
      document.getElementById('transfer-to-wallet')
    ];

    const stateKey = JSON.stringify(wallets.map(w => w.id + w.name + w.icon + w.balance + w.is_default));

    targets.forEach(selectEl => {
      if (!selectEl) return;
      const isFilter = selectEl.id === 'filter-wallet' || selectEl.id === 'filter-report-wallet';
      const currentValue = selectEl.value;

      if (selectEl.dataset.renderState === stateKey) {
        if (forceDefault && !isFilter) {
          const def = wallets.find(w => w.is_default);
          if (def) selectEl.value = def.id;
        }
        return;
      }
      selectEl.dataset.renderState = stateKey;

      selectEl.innerHTML = '';
      if (isFilter) {
        const opt = document.createElement('option');
        opt.value = 'all';
        opt.textContent = selectEl.id === 'filter-report-wallet' ? '🌐 Tất cả các ví' : 'Tất cả ví';
        selectEl.appendChild(opt);
      }

      let defaultWalletId = null;

      wallets.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        const fmtBal = db.formatVND ? db.formatVND(w.balance) : `${w.balance} ₫`;
        opt.textContent = `${w.icon ? w.icon + ' ' : ''}${w.name} (${fmtBal})`;
        
        if (w.is_default) {
          defaultWalletId = w.id;
          if (!isFilter && (!currentValue || forceDefault)) {
            opt.selected = true;
          }
        }
        
        selectEl.appendChild(opt);
      });

      if (forceDefault && defaultWalletId && !isFilter) {
        selectEl.value = defaultWalletId;
      } else if (currentValue && selectEl.querySelector(`option[value="${currentValue}"]`)) {
        selectEl.value = currentValue;
      }
    });
  },

  resetForm() {
    document.getElementById('transaction-form')?.reset();
    const amountInput = document.getElementById('input-amount');
    if (amountInput) amountInput.value = '';
    const wordsBox = document.getElementById('amount-in-words');
    if (wordsBox) { wordsBox.setAttribute('hidden', ''); wordsBox.style.display = 'none'; wordsBox.innerHTML = ''; }
    const expenseRadio = document.getElementById('type-expense');
    if (expenseRadio) expenseRadio.checked = true;
    const dateInput = document.getElementById('input-date');
    if (dateInput) dateInput.value = this._todayString();
    this.populateCategories('expense', true);
    this.populateWallets(true);
  },

  handleAmountInput(e) {
    const input = (e && e.target) ? e.target : (typeof e === 'string' ? document.getElementById(e) : e);
    if (!input) return;

    const raw = input.value || '';
    const cursor = input.selectionStart || raw.length;
    const formatted = formatVNDInput(raw);

    if (input.value !== formatted) {
      input.value = formatted;
      try {
        input.setSelectionRange(
          Math.max(0, cursor + (formatted.length - raw.length)),
          Math.max(0, cursor + (formatted.length - raw.length))
        );
      } catch (_) {}
    }

    // Live update Amount in Words
    const num = parseRawAmount(raw);
    const toWords = window.numberToVietnameseWords || numberToVietnameseWords;
    const words = typeof toWords === 'function' ? toWords(num) : '';

    let container = null;
    if (input.id === 'input-amount') {
      container = document.getElementById('amount-in-words');
    } else if (input.id === 'edit-tx-amount') {
      container = document.getElementById('edit-amount-in-words');
    } else if (input.id === 'transfer-amount') {
      container = document.getElementById('transfer-amount-words');
    }
    if (!container && input.closest) {
      container = input.closest('.form-group')?.querySelector('.amount-in-words');
    }

    if (container) {
      if (words) {
        container.innerHTML = `<span class="words-icon">🗣️</span> <span>Bằng chữ: <strong>${words}</strong></span>`;
        container.removeAttribute('hidden');
        container.style.display = 'flex';
      } else {
        container.setAttribute('hidden', '');
        container.style.display = 'none';
        container.innerHTML = '';
      }
    }
  },

  handleSubmit(e) {
    e?.preventDefault();

    const type = this.getCurrentType();
    const amount = parseRawAmount(document.getElementById('input-amount')?.value);
    const category = document.getElementById('input-category')?.value || '';
    const rawDate = document.getElementById('input-date')?.value;
    const date = window.formatLocalYMD ? window.formatLocalYMD(rawDate) : (rawDate || this._todayString());
    const note = (document.getElementById('input-note')?.value || '').trim();
    const wallet_id = document.getElementById('input-wallet')?.value || 'wallet_cash';

    const db = window.DB;
    const walletObj = db?.getWallet ? db.getWallet(wallet_id) : null;
    const wallet_name = walletObj ? walletObj.name : 'Ví tiền mặt';

    if (!amount || amount <= 0) {
      Toast.show('Số tiền phải là số dương hợp lệ', 'error');
      return null;
    }
    if (!category) {
      Toast.show('Vui lòng chọn hạng mục', 'warning');
      return null;
    }

    if (!db?.addTransaction) {
      Toast.show('Lỗi hệ thống: Chưa khởi tạo cơ sở dữ liệu!', 'error');
      return null;
    }

    const newTx = db.addTransaction({ type, amount, category, date, note, wallet_id, wallet_name });
    const fmtVND = window.formatVND ? window.formatVND(amount) : `${amount} ₫`;

    Toast.show(`Đã lưu ${type === 'expense' ? 'chi tiêu' : 'thu nhập'} ${fmtVND} vào ${wallet_name}!`, 'success');
    this.resetForm();

    try {
      window.dispatchEvent(new CustomEvent('transactionadded', { detail: { transaction: newTx } }));
    } catch (_) {}

    this.populateWallets();
    NetWorthManager.renderNetWorthView();

    return newTx;
  },

  init() {
    const dateInput = document.getElementById('input-date');
    if (dateInput && !dateInput.value) dateInput.value = this._todayString();
    this.populateCategories(this.getCurrentType());

    document.querySelectorAll('input[name="tx-type"]').forEach(r =>
      r.addEventListener('change', e => this.populateCategories(e.target.value))
    );

    // Multi-event listeners for mobile virtual keyboards (input, keyup, change, compositionend, focus)
    const amountEvents = ['input', 'keyup', 'change', 'compositionend', 'focus', 'blur'];
    const amountInput = document.getElementById('input-amount');
    if (amountInput) {
      amountEvents.forEach(evt => {
        amountInput.addEventListener(evt, e => this.handleAmountInput(e));
      });
    }

    // Document-level delegation fallback for mobile virtual keyboards
    amountEvents.forEach(evt => {
      document.addEventListener(evt, e => {
        if (e.target && (e.target.id === 'input-amount' || e.target.id === 'edit-tx-amount' || e.target.classList?.contains('amount-input'))) {
          this.handleAmountInput(e);
        }
      });
    });

    document.getElementById('transaction-form')
      ?.addEventListener('submit', e => this.handleSubmit(e));

    document.getElementById('btn-reset-tx')
      ?.addEventListener('click', () => this.resetForm());

    window.addEventListener('categorieschanged', () => this.populateCategories(this.getCurrentType()));
  }
};

/* --------------------------------------------------------------------------
   3-Tier Category Tree Manager & Modal Handlers
   -------------------------------------------------------------------------- */
const CategoryTreeManager = {
  renderTree() {
    const container = document.getElementById('category-manager-tree');
    if (!container) return;

    const catMgr = getModule('CategoryManager', 'Categories');
    if (!catMgr?.getGroups) return;

    const groups = catMgr.getGroups();
    const categories = catMgr.getCategories(true);

    let html = '';
    groups.forEach(group => {
      const subcats = categories.filter(c => c.group === group.name || c.groupId === group.id);
      const isExpense = group.type === 'expense';
      const badgeStyle = isExpense
        ? 'background:rgba(239,68,68,.1);color:#ef4444'
        : 'background:rgba(16,185,129,.1);color:#10b981';

      html += `
        <div class="category-group-card">
          <div class="group-card-header">
            <div class="group-card-title">
              <span class="group-icon">${group.icon || '📁'}</span>
              <strong>${group.name}</strong>
              <span class="group-type-badge" style="${badgeStyle}">${isExpense ? 'Chi tiêu' : 'Thu nhập'}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-xs btn-add-subcat-fast"
              data-group-name="${group.name}" data-group-type="${group.type}"
              title="Thêm hạng mục con">+ Con</button>
          </div>
          <div class="subcategories-pills-list">`;

      if (!subcats.length) {
        html += `<span class="empty-subcats">Chưa có hạng mục con</span>`;
      } else {
        subcats.forEach(sub => {
          const hidden = sub.isHidden || sub.is_hidden;
          html += `
            <span class="subcat-pill${hidden ? ' subcat-hidden' : ''}">
              <span>${sub.icon || '✨'}</span>
              <span>${sub.name}</span>
              <button type="button" class="btn-toggle-cat-hide" data-cat-id="${sub.id}"
                title="${hidden ? 'Hiện hạng mục' : 'Ẩn hạng mục'}">${hidden ? '👁️' : '🙈'}</button>
            </span>`;
        });
      }

      html += `</div></div>`;
    });

    const stateKey = JSON.stringify(groups.map(g => g.id + g.name)) + '_' + JSON.stringify(categories.map(c => c.id + c.name + c.isHidden + c.is_hidden + c.group + c.groupId));
    if (container.dataset.renderState === stateKey) return;
    container.dataset.renderState = stateKey;

    container.innerHTML = html;
  },

  populateAddCatGroups(type) {
    const selectEl = document.getElementById('add-cat-group');
    if (!selectEl) return;
    const catMgr = getModule('CategoryManager', 'Categories');
    const groups = catMgr?.getGroups?.(type) || [];
    selectEl.innerHTML = '';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.name;
      opt.textContent = `${g.icon ? g.icon + ' ' : ''}${g.name}`;
      selectEl.appendChild(opt);
    });
  },

  _openModal(id) {
    const modal = document.getElementById(`modal-${id}`);
    if (modal) { modal.removeAttribute('hidden'); modal.setAttribute('aria-hidden', 'false'); }
  },

  _closeModal(id) {
    const modal = document.getElementById(`modal-${id}`);
    if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
  },

  initEventListeners() {
    this.renderTree();

    document.addEventListener('click', e => {
      // Fast-add subcat button
      const fastBtn = e.target.closest('.btn-add-subcat-fast');
      if (fastBtn) {
        const groupName = fastBtn.dataset.groupName;
        const groupType = fastBtn.dataset.groupType;
        const typeSelect = document.getElementById('add-cat-type');
        if (typeSelect) typeSelect.value = groupType || 'expense';
        this.populateAddCatGroups(groupType);
        const groupSelect = document.getElementById('add-cat-group');
        if (groupSelect && groupName) groupSelect.value = groupName;
        this._openModal('add-cat');
        return;
      }

      // Toggle hide category
      const hideBtn = e.target.closest('.btn-toggle-cat-hide');
      if (hideBtn) {
        const catId = hideBtn.dataset.catId;
        const catMgr = getModule('CategoryManager', 'Categories');
        if (catId && catMgr?.toggleHideCategory) {
          try {
            catMgr.toggleHideCategory(catId);
            this.renderTree();
            Toast.show('Đã cập nhật trạng thái hạng mục', 'success');
          } catch (err) {
            Toast.show(err.message || 'Không thể cập nhật hạng mục', 'error');
          }
        }
        return;
      }

      // Close modal buttons
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        const target = closeBtn.dataset.closeModal;
        if (target === 'add-group') this._closeModal('add-group');
        else if (target === 'add-cat') this._closeModal('add-cat');
      }
    });

    document.getElementById('btn-open-add-group')?.addEventListener('click', () => this._openModal('add-group'));

    document.getElementById('btn-open-add-cat')?.addEventListener('click', () => {
      const type = document.getElementById('add-cat-type')?.value || 'expense';
      this.populateAddCatGroups(type);
      this._openModal('add-cat');
    });

    document.getElementById('add-cat-type')?.addEventListener('change', e => this.populateAddCatGroups(e.target.value));

    // Submit add group
    document.getElementById('form-add-group')?.addEventListener('submit', e => {
      e.preventDefault();
      const type = document.getElementById('add-group-type')?.value || 'expense';
      const name = document.getElementById('add-group-name')?.value?.trim();
      const icon = document.getElementById('add-group-icon')?.value?.trim() || '📁';
      if (!name) { Toast.show('Tên nhóm không được để trống', 'error'); return; }
      try {
        const catMgr = getModule('CategoryManager', 'Categories');
        if (catMgr?.addGroup) {
          catMgr.addGroup({ name, type, icon, color: type === 'income' ? '#10b981' : '#ef4444' });
          Toast.show(`Đã thêm nhóm chính "${name}"`, 'success');
          e.target.reset();
          this._closeModal('add-group');
          this.renderTree();
        }
      } catch (err) {
        Toast.show(err.message || 'Lỗi thêm nhóm chính', 'error');
      }
    });

    // Submit add subcategory
    document.getElementById('form-add-cat')?.addEventListener('submit', e => {
      e.preventDefault();
      const type = document.getElementById('add-cat-type')?.value || 'expense';
      const group = document.getElementById('add-cat-group')?.value;
      const name = document.getElementById('add-cat-name')?.value?.trim();
      const icon = document.getElementById('add-cat-icon')?.value?.trim() || '✨';
      if (!name) { Toast.show('Tên hạng mục con không được để trống', 'error'); return; }
      try {
        const catMgr = getModule('CategoryManager', 'Categories');
        if (catMgr?.addCategory) {
          catMgr.addCategory({ name, group, type, icon, color: type === 'income' ? '#10b981' : '#ef4444' });
          Toast.show(`Đã thêm hạng mục con "${name}"`, 'success');
          e.target.reset();
          this._closeModal('add-cat');
          this.renderTree();
        }
      } catch (err) {
        Toast.show(err.message || 'Lỗi thêm hạng mục con', 'error');
      }
    });

    window.addEventListener('categorieschanged', () => this.renderTree());
  }
};

/* --------------------------------------------------------------------------
   Net Worth & Enterprise Accounting UI Manager
   -------------------------------------------------------------------------- */
const NetWorthManager = {
  renderNetWorthView() {
    if (typeof document === 'undefined') return;
    const db = window.DB;
    if (!db) return;

    // 1. KPI Cards
    const nw = db.calculateNetWorth();
    const assetsEl = document.getElementById('nw-total-assets');
    const liabEl = document.getElementById('nw-total-liabilities');
    const nwEl = document.getElementById('nw-net-worth');

    if (assetsEl) assetsEl.textContent = db.formatVND(nw.totalAssets);
    if (liabEl) liabEl.textContent = db.formatVND(nw.totalLiabilities);
    if (nwEl) {
      nwEl.textContent = db.formatVND(nw.netWorth);
      nwEl.className = nw.netWorth < 0 ? 'summary-value negative-balance' : 'summary-value positive-balance';
    }

    // 0. Wallets Grid Rendering
    const wallets = db.getWallets(true);
    const walletsContainer = document.getElementById('wallets-list-container');
    if (walletsContainer) {
      const typeLabels = { cash: 'Tiền mặt', bank: 'Ngân hàng', ewallet: 'Ví điện tử', credit: 'Thẻ tín dụng' };
      let wHtml = '';
      wallets.forEach(w => {
        wHtml += `
          <div class="wallet-card" style="border-left: 4px solid ${w.color || '#10b981'};">
            <div class="wallet-card-header">
              <div class="wallet-title-wrapper">
                <span class="wallet-icon">${w.icon || '💵'}</span>
                <span class="wallet-name">${w.name}</span>
                ${w.is_default ? '<span class="wallet-default-pill">Mặc định</span>' : ''}
              </div>
              <span class="wallet-type-badge">${typeLabels[w.type] || w.type}</span>
            </div>
            <div class="wallet-balance">${db.formatVND(w.balance)}</div>
            <div class="wallet-actions">
              <button type="button" class="btn-edit-wallet icon-action-btn" data-edit-wallet="${w.id}" title="Chỉnh sửa ví">✏️</button>
              <button type="button" class="btn-delete-wallet icon-action-btn" data-delete-wallet="${w.id}" title="Xóa ví">&times;</button>
            </div>
          </div>
        `;
      });
      walletsContainer.innerHTML = wHtml;
    }

    // 2. Assets List
    const assets = db.getAssets();
    const assetContainer = document.getElementById('assets-list-container');
    if (assetContainer) {
      if (assets.length === 0) {
        assetContainer.innerHTML = '<p class="empty-list-msg">Chưa có tài sản nào được lưu.</p>';
      } else {
        let html = '<ul class="asset-items-list">';
        assets.forEach(a => {
          html += `
            <li class="asset-item" data-id="${a.id}">
              <div class="asset-main">
                <div class="asset-title-row">
                  <strong>${a.name}</strong>
                  <span class="asset-cat-tag">${a.category}</span>
                </div>
                ${a.note ? `<div class="asset-note-text">📝 ${a.note}</div>` : ''}
              </div>
              <div class="asset-val-box">
                <span class="asset-val-text income-text">${db.formatVND(a.value)}</span>
                <div class="asset-actions">
                  <button type="button" class="btn-edit-asset icon-action-btn" data-edit-asset="${a.id}" title="Chỉnh sửa tài sản">✏️</button>
                  <button type="button" class="btn-delete-asset icon-action-btn" data-delete-asset="${a.id}" title="Xóa tài sản">&times;</button>
                </div>
              </div>
            </li>
          `;
        });
        html += '</ul>';
        assetContainer.innerHTML = html;
      }
    }

    // 3. Liabilities List
    const liabilities = db.getLiabilities();
    const liabContainer = document.getElementById('liabilities-list-container');
    if (liabContainer) {
      if (liabilities.length === 0) {
        liabContainer.innerHTML = '<p class="empty-list-msg">Không có khoản nợ nào.</p>';
      } else {
        let html = '<ul class="asset-items-list">';
        liabilities.forEach(l => {
          html += `
            <li class="asset-item" data-id="${l.id}">
              <div class="asset-main">
                <div class="asset-title-row">
                  <strong>${l.name}</strong>
                  <span class="asset-cat-tag">${l.category}</span>
                </div>
                ${l.note ? `<div class="asset-note-text">📝 ${l.note}</div>` : ''}
              </div>
              <div class="asset-val-box">
                <span class="asset-val-text expense-text">${db.formatVND(l.remaining_debt)}</span>
                <div class="asset-actions">
                  <button type="button" class="btn-edit-liab icon-action-btn" data-edit-liab="${l.id}" title="Chỉnh sửa khoản nợ">✏️</button>
                  <button type="button" class="btn-delete-liab icon-action-btn" data-delete-liab="${l.id}" title="Xóa khoản nợ">&times;</button>
                </div>
              </div>
            </li>
          `;
        });
        html += '</ul>';
        liabContainer.innerHTML = html;
      }
    }

    // 4. Loans & Debts List
    const loans = db.getLoans();
    const loanContainer = document.getElementById('loans-list-container');
    if (loanContainer) {
      if (loans.length === 0) {
        loanContainer.innerHTML = '<p class="empty-list-msg">Chưa có hợp đồng vay hoặc cho vay nào.</p>';
      } else {
        let html = '<div class="loans-grid">';
        loans.forEach(l => {
          const isLoan = l.type === 'loan';
          const typeBadge = isLoan ? '🤝 Cho vay' : '💸 Đi vay';
          const badgeClass = isLoan ? 'badge-income' : 'badge-expense';

          html += `
            <div class="loan-card" data-id="${l.id}">
              <div class="loan-card-header">
                <div>
                  <strong>${l.person_name}</strong>
                  <span class="loan-type-badge ${badgeClass}">${typeBadge}</span>
                </div>
                <span class="loan-status ${l.status === 'paid' ? 'status-paid' : 'status-active'}">
                  ${l.status === 'paid' ? '✅ Đã xong' : '⏳ Đang trả'}
                </span>
              </div>
              <div class="loan-card-body">
                <span>Còn lại: <strong class="${isLoan ? 'income-text' : 'expense-text'}">${db.formatVND(l.remaining_amount)}</strong> / ${db.formatVND(l.original_amount)}</span>
                ${l.due_date ? `<span class="loan-due">Hạn: ${l.due_date}</span>` : ''}
                ${l.note ? `<div class="loan-note-text">📝 ${l.note}</div>` : ''}
              </div>
              <div class="loan-card-footer">
                ${l.status !== 'paid' ? `<button type="button" class="btn btn-secondary btn-sm" data-repay-loan="${l.id}">💸 Trả gốc & lãi</button>` : ''}
                <div class="loan-actions">
                  <button type="button" class="btn-edit-loan icon-action-btn" data-edit-loan="${l.id}" title="Chỉnh sửa sổ vay">✏️</button>
                  <button type="button" class="btn-delete-loan icon-action-btn" data-delete-loan="${l.id}" title="Xóa sổ vay">&times;</button>
                </div>
              </div>
            </div>
          `;
        });
        html += '</div>';
        loanContainer.innerHTML = html;
      }
    }
  },

  renderAuditLogs() {
    const db = window.DB;
    const container = document.getElementById('audit-log-items-container');
    if (!db || !container) return;

    const logs = db.getAuditLogs();
    if (logs.length === 0) {
      container.innerHTML = '<p class="empty-list-msg">Chưa có lịch sử vết sửa nào.</p>';
      return;
    }

    let html = '<div class="audit-timeline">';
    logs.forEach(l => {
      const actionMap = {
        add: '➕ Thêm mới',
        update: '✏️ Chỉnh sửa',
        delete: '🗑️ Xóa giao dịch',
        revert: '🔄 Phục hồi (Revert)'
      };
      const timeStr = new Date(l.timestamp).toLocaleString('vi-VN');

      html += `
        <div class="audit-item audit-action-${l.action}">
          <div class="audit-header">
            <span class="audit-action-badge">${actionMap[l.action] || l.action}</span>
            <span class="audit-time">${timeStr}</span>
          </div>
          <div class="audit-details">
            <span class="audit-entity">ID: ${l.entity_id}</span>
            ${l.old_data ? `<div class="audit-diff">Cũ: ${l.old_data.category} - ${db.formatVND(l.old_data.amount)} (${l.old_data.note || ''})</div>` : ''}
            ${l.new_data ? `<div class="audit-diff">Mới: ${l.new_data.category} - ${db.formatVND(l.new_data.amount)} (${l.new_data.note || ''})</div>` : ''}
          </div>
          ${l.action !== 'revert' ? `
            <button type="button" class="btn btn-secondary btn-sm btn-revert-audit" data-revert-audit="${l.id}">🔄 Phục hồi</button>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  renderRecurringItems() {
    const db = window.DB;
    const container = document.getElementById('recurring-items-list');
    if (!db || !container) return;

    const items = db.getRecurring();
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-list-msg">Chưa có lịch thu chi định kỳ nào.</p>';
      return;
    }

    let html = '<ul class="recurring-list">';
    items.forEach(r => {
      html += `
        <li class="recurring-item">
          <div>
            <strong>${r.category}</strong> (${r.type === 'income' ? 'Thu' : 'Chi'})
            <span class="rec-note">Ngày ${r.day_of_month} hàng tháng • ${r.note || 'Không có ghi chú'}</span>
          </div>
          <div class="rec-right">
            <span class="${r.type === 'income' ? 'income-text' : 'expense-text'}">${db.formatVND(r.amount)}</span>
            <button type="button" class="btn-delete-rec" data-delete-rec="${r.id}">&times;</button>
          </div>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  },

  initEventListeners() {
    if (typeof document === 'undefined') return;

    // Route hooks
    Router.on('networth', () => this.renderNetWorthView());

    // Auto-refresh wallet balances & net worth when sync updates data from another device
    window.addEventListener('walletschanged', () => {
      this.renderNetWorthView();
      TransactionForm.populateWallets();
    });
    window.addEventListener('assetschanged', () => this.renderNetWorthView());
    window.addEventListener('loanschanged', () => this.renderNetWorthView());
    window.addEventListener('transactionschanged', () => {
      this.renderNetWorthView();
      TransactionForm.populateWallets();
    });
    window.addEventListener('transactionupdated', () => {
      this.renderNetWorthView();
      TransactionForm.populateWallets();
    });

    // Modal open buttons (Reset inputs for new addition)
    document.getElementById('btn-open-add-wallet')?.addEventListener('click', () => {
      document.getElementById('form-wallet')?.reset();
      const idInput = document.getElementById('wallet-id');
      if (idInput) idInput.value = '';
      const balInput = document.getElementById('wallet-initial-balance');
      if (balInput) TransactionForm.handleAmountInput(balInput);
      const titleEl = document.getElementById('wallet-modal-title');
      if (titleEl) titleEl.textContent = '💼 Thêm Ví Mới';
      document.getElementById('modal-wallet')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-transfer')?.addEventListener('click', () => {
      document.getElementById('form-transfer')?.reset();
      TransactionForm.populateWallets(true);
      const amtInput = document.getElementById('transfer-amount');
      if (amtInput) TransactionForm.handleAmountInput(amtInput);
      const dateInput = document.getElementById('transfer-date');
      if (dateInput) dateInput.value = TransactionForm._todayString();
      document.getElementById('modal-transfer')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-add-asset')?.addEventListener('click', () => {
      document.getElementById('form-asset')?.reset();
      const idInput = document.getElementById('asset-id');
      if (idInput) idInput.value = '';
      const titleEl = document.getElementById('asset-modal-title');
      if (titleEl) titleEl.textContent = 'Thêm / Sửa Tài Sản';
      document.getElementById('modal-asset')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-add-liab')?.addEventListener('click', () => {
      document.getElementById('form-liability')?.reset();
      const idInput = document.getElementById('liab-id');
      if (idInput) idInput.value = '';
      const titleEl = document.getElementById('liability-modal-title');
      if (titleEl) titleEl.textContent = 'Thêm / Sửa Khoản Nợ Phải Trả';
      document.getElementById('modal-liability')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-add-loan')?.addEventListener('click', () => {
      document.getElementById('form-loan')?.reset();
      const idInput = document.getElementById('loan-id');
      if (idInput) idInput.value = '';
      const titleEl = document.getElementById('loan-modal-title');
      if (titleEl) titleEl.textContent = 'Sổ Vay & Cho Vay';
      document.getElementById('modal-loan')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-audit-log')?.addEventListener('click', () => {
      this.renderAuditLogs();
      document.getElementById('modal-audit')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-recurring')?.addEventListener('click', () => {
      this.renderRecurringItems();
      document.getElementById('modal-recurring')?.removeAttribute('hidden');
    });

    // Close modal triggers
    ['asset', 'liability', 'loan', 'recurring', 'audit', 'repay', 'wallet', 'transfer'].forEach(name => {
      document.querySelectorAll(`[data-close-modal="${name}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById(`modal-${name}`)?.setAttribute('hidden', '');
        });
      });
    });

    // Wallet Form submit
    document.getElementById('form-wallet')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const id = document.getElementById('wallet-id')?.value || undefined;
      const name = document.getElementById('wallet-name')?.value;
      const type = document.getElementById('wallet-type')?.value;
      const icon = document.getElementById('wallet-icon')?.value || '💵';
      const initial_balance = parseRawAmount(document.getElementById('wallet-initial-balance')?.value);
      const color = document.getElementById('wallet-color')?.value || '#10b981';
      const is_default = document.getElementById('wallet-is-default')?.checked;

      db.saveWallet({ id, name, type, icon, initial_balance, balance: initial_balance, color, is_default });
      document.getElementById('modal-wallet')?.setAttribute('hidden', '');
      TransactionForm.populateWallets(true);
      this.renderNetWorthView();
      Toast.show(id ? 'Đã cập nhật thông tin ví' : 'Đã tạo ví mới thành công', 'success');
    });

    // Transfer Form submit
    document.getElementById('form-transfer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const fromId = document.getElementById('transfer-from-wallet')?.value;
      const toId = document.getElementById('transfer-to-wallet')?.value;
      const amount = parseRawAmount(document.getElementById('transfer-amount')?.value);
      const date = document.getElementById('transfer-date')?.value;
      const note = document.getElementById('transfer-note')?.value;

      try {
        const res = db.transferBetweenWallets(fromId, toId, amount, note, date);
        document.getElementById('modal-transfer')?.setAttribute('hidden', '');
        TransactionForm.populateWallets();
        this.renderNetWorthView();
        Toast.show(`Đã chuyển ${db.formatVND(amount)} thành công!`, 'success');
        try {
          window.dispatchEvent(new CustomEvent('transactionadded', { detail: { transaction: res.outTx } }));
        } catch (_) {}
      } catch (err) {
        Toast.show(err.message, 'error');
      }
    });

    // Asset Form submit
    document.getElementById('form-asset')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const id = document.getElementById('asset-id')?.value || undefined;
      const name = document.getElementById('asset-name')?.value;
      const category = document.getElementById('asset-category')?.value;
      const value = parseRawAmount(document.getElementById('asset-value')?.value);
      const note = document.getElementById('asset-note')?.value;

      db.saveAsset({ id, name, category, value, note });
      document.getElementById('modal-asset')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show(id ? 'Đã cập nhật tài sản thành công' : 'Đã lưu tài sản mới thành công', 'success');
    });

    // Liability Form submit
    document.getElementById('form-liability')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const id = document.getElementById('liab-id')?.value || undefined;
      const name = document.getElementById('liab-name')?.value;
      const category = document.getElementById('liab-category')?.value;
      const remaining_debt = parseRawAmount(document.getElementById('liab-remaining')?.value);
      const note = document.getElementById('liab-note')?.value;

      db.saveLiability({ id, name, category, remaining_debt, note });
      document.getElementById('modal-liability')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show(id ? 'Đã cập nhật khoản nợ thành công' : 'Đã lưu khoản nợ thành công', 'success');
    });

    // Loan Form submit
    document.getElementById('form-loan')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const id = document.getElementById('loan-id')?.value || undefined;
      const type = document.querySelector('input[name="loan-type"]:checked')?.value || 'loan';
      const person_name = document.getElementById('loan-person')?.value;
      const original_amount = parseRawAmount(document.getElementById('loan-amount')?.value);
      const due_date = document.getElementById('loan-due-date')?.value;
      const note = document.getElementById('loan-note')?.value;

      db.saveLoan({ id, type, person_name, original_amount, due_date, note });
      document.getElementById('modal-loan')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show(id ? 'Đã cập nhật hợp đồng vay mượn' : 'Đã lưu sổ vay mượn mới', 'success');
    });

    // Repay Loan Form submit
    document.getElementById('form-repay-loan')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const id = document.getElementById('repay-loan-id')?.value;
      const principal = parseRawAmount(document.getElementById('repay-principal')?.value);
      const interest = parseRawAmount(document.getElementById('repay-interest')?.value);

      if (id && principal > 0) {
        db.recordLoanRepayment(id, { principal, interest });
        document.getElementById('modal-repay-loan')?.setAttribute('hidden', '');
        this.renderNetWorthView();
        Toast.show('Đã ghi nhận thanh toán thành công', 'success');
      } else {
        Toast.show('Số tiền gốc thanh toán phải lớn hơn 0', 'error');
      }
    });

    // Recurring Form submit
    document.getElementById('form-add-recurring')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const type = document.getElementById('rec-type')?.value;
      const amount = parseRawAmount(document.getElementById('rec-amount')?.value);
      const category = document.getElementById('rec-category')?.value;
      const day_of_month = document.getElementById('rec-day')?.value;
      const note = document.getElementById('rec-note')?.value;

      db.saveRecurring({ type, amount, category, day_of_month, note });
      this.renderRecurringItems();
      Toast.show('Đã lưu lịch thu chi định kỳ', 'success');
    });

    // Delegation clicks for edit & delete asset, liability, loan, repay loan, revert audit log
    document.addEventListener('click', (e) => {
      const db = window.DB;
      if (!db) return;

      // EDIT WALLET
      const editWalletBtn = e.target?.closest('[data-edit-wallet]');
      if (editWalletBtn) {
        const id = editWalletBtn.getAttribute('data-edit-wallet');
        const wallet = db.getWallet(id);
        if (wallet) {
          document.getElementById('wallet-id').value = wallet.id;
          document.getElementById('wallet-name').value = wallet.name;
          document.getElementById('wallet-type').value = wallet.type || 'cash';
          document.getElementById('wallet-icon').value = wallet.icon || '💵';
          const balInput = document.getElementById('wallet-initial-balance');
          if (balInput) {
            balInput.value = formatVNDInput(wallet.initial_balance || 0);
            TransactionForm.handleAmountInput(balInput);
          }
          document.getElementById('wallet-color').value = wallet.color || '#10b981';
          document.getElementById('wallet-is-default').checked = !!wallet.is_default;
          const titleEl = document.getElementById('wallet-modal-title');
          if (titleEl) titleEl.textContent = '✏️ Chỉnh Sửa Ví';
          document.getElementById('modal-wallet')?.removeAttribute('hidden');
        }
      }

      // DELETE WALLET
      const deleteWalletBtn = e.target?.closest('[data-delete-wallet]');
      if (deleteWalletBtn) {
        const id = deleteWalletBtn.getAttribute('data-delete-wallet');
        if (confirm('Bạn có chắc chắn muốn xóa ví này không?')) {
          try {
            db.deleteWallet(id);
            TransactionForm.populateWallets();
            this.renderNetWorthView();
            Toast.show('Đã xóa ví thành công', 'success');
          } catch (err) {
            Toast.show(err.message, 'error');
          }
        }
      }

      // EDIT ASSET
      const editAssetBtn = e.target?.closest('[data-edit-asset]');
      if (editAssetBtn) {
        const id = editAssetBtn.getAttribute('data-edit-asset');
        const assets = db.getAssets();
        const target = assets.find(a => a.id === id);
        if (target) {
          document.getElementById('asset-id').value = target.id;
          document.getElementById('asset-name').value = target.name;
          document.getElementById('asset-category').value = target.category || 'Tài khoản ngân hàng';
          const valInput = document.getElementById('asset-value');
          if (valInput) {
            valInput.value = formatVNDInput(target.value);
            TransactionForm.handleAmountInput(valInput);
          }
          document.getElementById('asset-note').value = target.note || '';
          const titleEl = document.getElementById('asset-modal-title');
          if (titleEl) titleEl.textContent = '✏️ Chỉnh Sửa Tài Sản';
          document.getElementById('modal-asset')?.removeAttribute('hidden');
        }
      }

      // EDIT LIABILITY
      const editLiabBtn = e.target?.closest('[data-edit-liab]');
      if (editLiabBtn) {
        const id = editLiabBtn.getAttribute('data-edit-liab');
        const liabilities = db.getLiabilities();
        const target = liabilities.find(l => l.id === id);
        if (target) {
          document.getElementById('liab-id').value = target.id;
          document.getElementById('liab-name').value = target.name;
          document.getElementById('liab-category').value = target.category || 'Thẻ tín dụng';
          const valInput = document.getElementById('liab-remaining');
          if (valInput) {
            valInput.value = formatVNDInput(target.remaining_debt);
            TransactionForm.handleAmountInput(valInput);
          }
          document.getElementById('liab-note').value = target.note || '';
          const titleEl = document.getElementById('liability-modal-title');
          if (titleEl) titleEl.textContent = '✏️ Chỉnh Sửa Khoản Nợ Phải Trả';
          document.getElementById('modal-liability')?.removeAttribute('hidden');
        }
      }

      // EDIT LOAN
      const editLoanBtn = e.target?.closest('[data-edit-loan]');
      if (editLoanBtn) {
        const id = editLoanBtn.getAttribute('data-edit-loan');
        const loans = db.getLoans();
        const target = loans.find(l => l.id === id);
        if (target) {
          document.getElementById('loan-id').value = target.id;
          if (target.type === 'loan') {
            document.getElementById('loan-type-loan').checked = true;
          } else {
            document.getElementById('loan-type-debt').checked = true;
          }
          document.getElementById('loan-person').value = target.person_name;
          const amtInput = document.getElementById('loan-amount');
          if (amtInput) {
            amtInput.value = formatVNDInput(target.original_amount);
            TransactionForm.handleAmountInput(amtInput);
          }
          document.getElementById('loan-due-date').value = target.due_date || '';
          document.getElementById('loan-note').value = target.note || '';
          const titleEl = document.getElementById('loan-modal-title');
          if (titleEl) titleEl.textContent = '✏️ Chỉnh Sửa Sổ Vay & Cho Vay';
          document.getElementById('modal-loan')?.removeAttribute('hidden');
        }
      }

      const delAsset = e.target?.closest('[data-delete-asset]');
      if (delAsset) {
        const id = delAsset.getAttribute('data-delete-asset');
        db.deleteAsset(id);
        this.renderNetWorthView();
        Toast.show('Đã xóa tài sản', 'info');
      }

      const delLiab = e.target?.closest('[data-delete-liab]');
      if (delLiab) {
        const id = delLiab.getAttribute('data-delete-liab');
        db.deleteLiability(id);
        this.renderNetWorthView();
        Toast.show('Đã xóa khoản nợ', 'info');
      }

      const delLoan = e.target?.closest('[data-delete-loan]');
      if (delLoan) {
        const id = delLoan.getAttribute('data-delete-loan');
        db.deleteLoan(id);
        this.renderNetWorthView();
        Toast.show('Đã xóa sổ vay', 'info');
      }

      const repayLoan = e.target?.closest('[data-repay-loan]');
      if (repayLoan) {
        const id = repayLoan.getAttribute('data-repay-loan');
        const loans = db.getLoans();
        const target = loans.find(l => l.id === id);
        if (target) {
          const idInput = document.getElementById('repay-loan-id');
          if (idInput) idInput.value = id;

          const infoEl = document.getElementById('repay-target-info');
          if (infoEl) infoEl.innerHTML = `Thanh toán cho khoản vay <strong>${target.person_name}</strong> (Dư nợ còn lại: <strong>${db.formatVND(target.remaining_amount)}</strong>)`;
          
          const principalInput = document.getElementById('repay-principal');
          if (principalInput) {
            principalInput.value = formatVNDInput(target.remaining_amount);
            TransactionForm.handleAmountInput(principalInput);
          }
          const interestInput = document.getElementById('repay-interest');
          if (interestInput) {
            interestInput.value = '0';
            TransactionForm.handleAmountInput(interestInput);
          }

          document.getElementById('modal-repay-loan')?.removeAttribute('hidden');
        }
      }

      const delRec = e.target?.closest('[data-delete-rec]');
      if (delRec) {
        const id = delRec.getAttribute('data-delete-rec');
        db.deleteRecurring(id);
        this.renderRecurringItems();
        Toast.show('Đã xóa lịch định kỳ', 'info');
      }

      const revertAudit = e.target?.closest('[data-revert-audit]');
      if (revertAudit) {
        const id = revertAudit.getAttribute('data-revert-audit');
        try {
          db.revertAuditEvent(id);
          this.renderAuditLogs();
          this.renderNetWorthView();
          window.dispatchEvent(new CustomEvent('transactionupdated'));
          Toast.show('Đã phục hồi (revert) bản ghi thành công', 'success');
        } catch (err) {
          Toast.show(err.message || 'Không thể phục hồi bản ghi', 'error');
        }
      }
    });
  }
};

const App = {
  init() {
    try {
      ThemeEngine.init();

      Router.on('budget', () => {
        const ui = getModule('HistoryUI', 'HistoryManager');
        ui?.init?.() || ui?.render?.();
      });

      Router.on('reports', () => {
        const ui = getModule('ChartsUI', 'Charts');
        ui?.init?.() || ui?.renderCharts?.();
      });

      Router.init();
      registerServiceWorker();
      TransactionForm.init();
      TransactionForm.populateWallets(true);

      getModule('HistoryUI', 'HistoryManager')?.initEventListeners?.();
      getModule('ChartsUI', 'Charts')?.initEventListeners?.();
      CategoryTreeManager.initEventListeners();
      NetWorthManager.initEventListeners();

      // Check automated recurring transactions
      setTimeout(() => {
        const genCount = window.DB?.checkAndGenerateRecurringTransactions?.();
        if (genCount > 0) {
          Toast.show(`⚡ Tự động phát sinh ${genCount} giao dịch định kỳ hôm nay`, 'info');
          window.dispatchEvent(new CustomEvent('transactionadded'));
        }
      }, 1000);

      // SQLite Backend & Dump Export/Import Event Listeners
      const btnExportSql = document.getElementById('btn-export-sqlite');
      if (btnExportSql) {
        btnExportSql.addEventListener('click', () => {
          try {
            const sqlDump = window.DB.exportSql();
            const blob = new Blob([sqlDump], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sothuchi_sqlite_backup_${new Date().toISOString().split('T')[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('Đã tải xuống file SQLite Dump (.sql) thành công', 'success');
          } catch (err) {
            Toast.show(err.message || 'Lỗi xuất file SQLite', 'error');
          }
        });
      }

      const btnTriggerImport = document.getElementById('btn-trigger-import-sqlite');
      const fileImportSql = document.getElementById('file-import-sqlite');
      if (btnTriggerImport && fileImportSql) {
        btnTriggerImport.addEventListener('click', () => fileImportSql.click());
        fileImportSql.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const text = event.target.result;
              const res = window.DB.importSql(text);
              Toast.show(`Đã khôi phục thành công ${res.imported_transactions} giao dịch từ file SQL`, 'success');
              window.dispatchEvent(new CustomEvent('transactionadded'));
            } catch (err) {
              Toast.show(err.message || 'Lỗi khôi phục file SQL', 'error');
            }
          };
          reader.readAsText(file);
        });
      }

      const btnSaveSqliteUrl = document.getElementById('btn-save-sqlite-url');
      const inputSqliteUrl = document.getElementById('input-sqlite-url');
      if (btnSaveSqliteUrl && inputSqliteUrl) {
        const syncEngine = window.SyncEngine;
        if (syncEngine) {
          const currentSettings = syncEngine.getSettings();
          if (currentSettings?.gasUrl) {
            inputSqliteUrl.value = currentSettings.gasUrl;
          }
        }
        btnSaveSqliteUrl.addEventListener('click', () => {
          const newUrl = inputSqliteUrl.value.trim();
          if (!newUrl) {
            Toast.show('Vui lòng nhập URL Endpoint', 'error');
            return;
          }
          if (window.SyncEngine) {
            window.SyncEngine.saveSettings({ gasUrl: newUrl });
            Toast.show('Đã lưu URL SQLite / Cloudflare D1 Endpoint thành công', 'success');
          }
        });
      }

      // Initialize Auto-Save & Enter Submit System
      AutoSaveManager.init();

    } catch (err) {
      console.warn('[App] Initialization warning:', err);
    }
  }
};

/* --------------------------------------------------------------------------
   Auto-Save & Enter Key Auto-Submit System
   -------------------------------------------------------------------------- */
const AutoSaveManager = {
  init() {
    this.setupEnterSubmit();
    this.setupDraftAutoSave();
    this.setupFormBlurAutoSave();
  },

  setupEnterSubmit() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const target = e.target;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

      const form = target.closest('form');
      if (form) {
        e.preventDefault();
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });
  },

  setupDraftAutoSave() {
    const formIds = ['transaction-form', 'form-wallet', 'form-asset', 'form-liability', 'form-loan', 'form-add-recurring'];
    formIds.forEach(id => {
      const form = document.getElementById(id);
      if (!form) return;

      this.restoreDraft(form, id);

      ['input', 'change'].forEach(evtType => {
        form.addEventListener(evtType, () => {
          this.saveDraft(form, id);
        });
      });

      form.addEventListener('submit', () => {
        try { sessionStorage.removeItem(`stc_draft_${id}`); } catch (_) {}
      });
    });
  },

  saveDraft(form, formId) {
    try {
      const inputs = form.querySelectorAll('input, select, textarea');
      const data = {};
      inputs.forEach(input => {
        if (input.id || input.name) {
          data[input.id || input.name] = input.value;
        }
      });
      sessionStorage.setItem(`stc_draft_${formId}`, JSON.stringify(data));
    } catch (_) {}
  },

  restoreDraft(form, formId) {
    try {
      const raw = sessionStorage.getItem(`stc_draft_${formId}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.keys(data).forEach(key => {
        const input = form.querySelector(`#${key}, [name="${key}"]`);
        if (input && !input.value && data[key]) {
          input.value = data[key];
        }
      });
    } catch (_) {}
  },

  setupFormBlurAutoSave() {
    window.addEventListener('transactionadded', () => this.showAutoSaveBadge());
    window.addEventListener('transactionupdated', () => this.showAutoSaveBadge());
    window.addEventListener('transactiondeleted', () => this.showAutoSaveBadge());
    window.addEventListener('walletschanged', () => this.showAutoSaveBadge());
    window.addEventListener('assetschanged', () => this.showAutoSaveBadge());
    window.addEventListener('loanschanged', () => this.showAutoSaveBadge());
  },

  showAutoSaveBadge() {
    const badge = document.getElementById('sync-status-badge');
    if (badge) {
      badge.classList.add('auto-save-pulse');
      setTimeout(() => badge.classList.remove('auto-save-pulse'), 1500);
    }
  }
};

/* --------------------------------------------------------------------------
   Global Exports
   -------------------------------------------------------------------------- */
Object.assign(window, {
  App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, NetWorthManager, Toast, AutoSaveManager,
  parseRawAmount, formatVNDInput, numberToVietnameseWords
});
if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, {
    App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, NetWorthManager, Toast, AutoSaveManager,
    parseRawAmount, formatVNDInput, numberToVietnameseWords
  });
}

/* --------------------------------------------------------------------------
   Entry Point
   -------------------------------------------------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
