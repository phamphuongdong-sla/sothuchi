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
  ROUTES: ['transactions', 'budget', 'reports', 'settings'],
  TITLES: {
    transactions: 'Giao dịch',
    budget: 'Ngân sách',
    reports: 'Báo cáo',
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

    // Update view panels
    querySelectorAllMultiple(['.view-panel', '[data-view-content]', '[data-route]']).forEach(panel => {
      const route = panel.getAttribute('data-route') ||
                    panel.getAttribute('data-view-content') ||
                    panel.id?.replace(/^view-/, '') || '';
      if (route === active) {
        panel.classList.add('active');
        panel.removeAttribute('hidden');
      } else {
        panel.classList.remove('active');
        panel.setAttribute('hidden', '');
      }
    });

    // Update nav links
    querySelectorAllMultiple(['.nav-link', '[data-view]', '[role="tab"]']).forEach(link => {
      const route = link.getAttribute('data-view') ||
                    link.getAttribute('href')?.replace(/^#\/?/, '').trim() ||
                    link.id?.replace(/^nav-/, '') || '';
      const isActive = route === active;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-selected', String(isActive));
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

/* --------------------------------------------------------------------------
   Transaction Form Handler
   -------------------------------------------------------------------------- */
const TransactionForm = {
  _todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    const expenseRadio = document.getElementById('type-expense');
    if (expenseRadio) expenseRadio.checked = true;
    const dateInput = document.getElementById('input-date');
    if (dateInput) dateInput.value = this._todayString();
    this.populateCategories('expense');
  },

  handleAmountInput(e) {
    const input = e.target;
    const raw = input.value;
    const cursor = input.selectionStart || raw.length;
    const formatted = formatVNDInput(raw);
    input.value = formatted;
    try {
      input.setSelectionRange(
        Math.max(0, cursor + (formatted.length - raw.length)),
        Math.max(0, cursor + (formatted.length - raw.length))
      );
    } catch (_) {}
  },

  handleSubmit(e) {
    e?.preventDefault();

    const type = this.getCurrentType();
    const amount = parseRawAmount(document.getElementById('input-amount')?.value);
    const category = document.getElementById('input-category')?.value || '';
    const date = document.getElementById('input-date')?.value || this._todayString();
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
    Toast.show(`Đã thêm ${type === 'expense' ? 'chi tiêu' : 'thu nhập'} ${fmtVND}!`, 'success');
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

    document.getElementById('input-amount')
      ?.addEventListener('input', e => this.handleAmountInput(e));

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
   Master App Initializer
   -------------------------------------------------------------------------- */
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

    } catch (err) {
      console.warn('[App] Initialization warning:', err);
    }
  }
};

/* --------------------------------------------------------------------------
   Global Exports
   -------------------------------------------------------------------------- */
Object.assign(window, {
  App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, Toast,
  parseRawAmount, formatVNDInput
});
if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, {
    App, ThemeEngine, Router, TransactionForm, CategoryTreeManager, Toast,
    parseRawAmount, formatVNDInput
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
