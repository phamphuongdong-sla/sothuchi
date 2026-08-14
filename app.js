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

  populateCategories(type) {
    const selectEl = document.getElementById('input-category');
    if (!selectEl) return;

    type = type || this.getCurrentType();

    const catMgr = getModule('Categories', 'CategoryManager');
    let categories = [];
    if (catMgr?.getActive) {
      categories = catMgr.getActive(type);
    } else {
      categories = (window.DB?.getCategories(false) || []).filter(c => c.type === type);
    }

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

    if (categories.length) selectEl.value = categories[0].name;
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
    this.populateCategories('expense');
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

    if (!amount || amount <= 0) {
      Toast.show('Số tiền phải là số dương hợp lệ', 'error');
      return null;
    }
    if (!category) {
      Toast.show('Vui lòng chọn hạng mục', 'warning');
      return null;
    }

    const db = window.DB;
    if (!db?.addTransaction) {
      Toast.show('Lỗi hệ thống: Chưa khởi tạo cơ sở dữ liệu!', 'error');
      return null;
    }

    const newTx = db.addTransaction({ type, amount, category, date, note });
    const fmtVND = window.formatVND ? window.formatVND(amount) : `${amount} ₫`;
    const dateParts = (date || '').split('-');
    const fmtDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;

    Toast.show(`Đã lưu ${type === 'expense' ? 'chi tiêu' : 'thu nhập'} ${fmtVND} (Ngày ${fmtDate})!`, 'success');
    this.resetForm();

    try {
      window.dispatchEvent(new CustomEvent('transactionadded', { detail: { transaction: newTx } }));
    } catch (_) {}

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
            <li class="asset-item">
              <div class="asset-main">
                <strong>${a.name}</strong>
                <span class="asset-cat-tag">${a.category}</span>
              </div>
              <div class="asset-val-box">
                <span class="asset-val-text">${db.formatVND(a.value)}</span>
                <button type="button" class="btn-delete-asset" data-delete-asset="${a.id}">&times;</button>
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
            <li class="asset-item">
              <div class="asset-main">
                <strong>${l.name}</strong>
                <span class="asset-cat-tag">${l.category}</span>
              </div>
              <div class="asset-val-box">
                <span class="asset-val-text expense-text">${db.formatVND(l.remaining_debt)}</span>
                <button type="button" class="btn-delete-liab" data-delete-liab="${l.id}">&times;</button>
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
            <div class="loan-card">
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
              </div>
              ${l.status !== 'paid' ? `
                <div class="loan-card-footer">
                  <button type="button" class="btn btn-secondary btn-sm" data-repay-loan="${l.id}">💸 Trả gốc & lãi</button>
                  <button type="button" class="btn-delete-loan" data-delete-loan="${l.id}">&times;</button>
                </div>
              ` : ''}
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

    // Modal open buttons
    document.getElementById('btn-open-add-asset')?.addEventListener('click', () => {
      document.getElementById('modal-asset')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-add-liab')?.addEventListener('click', () => {
      document.getElementById('modal-liability')?.removeAttribute('hidden');
    });

    document.getElementById('btn-open-add-loan')?.addEventListener('click', () => {
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
    ['asset', 'liability', 'loan', 'recurring', 'audit', 'repay'].forEach(name => {
      document.querySelectorAll(`[data-close-modal="${name}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById(`modal-${name}`)?.setAttribute('hidden', '');
        });
      });
    });

    // Asset Form submit
    document.getElementById('form-asset')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const name = document.getElementById('asset-name')?.value;
      const category = document.getElementById('asset-category')?.value;
      const value = parseRawAmount(document.getElementById('asset-value')?.value);
      const note = document.getElementById('asset-note')?.value;

      db.saveAsset({ name, category, value, note });
      document.getElementById('modal-asset')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show('Đã lưu tài sản mới thành công', 'success');
    });

    // Liability Form submit
    document.getElementById('form-liability')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const name = document.getElementById('liab-name')?.value;
      const category = document.getElementById('liab-category')?.value;
      const remaining_debt = parseRawAmount(document.getElementById('liab-remaining')?.value);
      const note = document.getElementById('liab-note')?.value;

      db.saveLiability({ name, category, remaining_debt, note });
      document.getElementById('modal-liability')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show('Đã lưu khoản nợ thành công', 'success');
    });

    // Loan Form submit
    document.getElementById('form-loan')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const db = window.DB;
      if (!db) return;
      const type = document.querySelector('input[name="loan-type"]:checked')?.value || 'loan';
      const person_name = document.getElementById('loan-person')?.value;
      const original_amount = parseRawAmount(document.getElementById('loan-amount')?.value);
      const due_date = document.getElementById('loan-due-date')?.value;
      const note = document.getElementById('loan-note')?.value;

      db.saveLoan({ type, person_name, original_amount, due_date, note });
      document.getElementById('modal-loan')?.setAttribute('hidden', '');
      this.renderNetWorthView();
      Toast.show('Đã lưu sổ vay mượn mới', 'success');
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

    // Delegation clicks for delete asset, delete liability, delete loan, repay loan, revert audit log
    document.addEventListener('click', (e) => {
      const db = window.DB;
      if (!db) return;

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

    } catch (err) {
      console.warn('[App] Initialization warning:', err);
    }
  }
};

/* --------------------------------------------------------------------------
   Global Exports
   -------------------------------------------------------------------------- */
Object.assign(window, {
  App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, NetWorthManager, Toast,
  parseRawAmount, formatVNDInput, numberToVietnameseWords
});
if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, {
    App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, NetWorthManager, Toast,
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
