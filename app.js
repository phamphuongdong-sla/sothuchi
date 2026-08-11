/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Main Application Entry & Infrastructure
   Milestone M1 Implementation: Theme Engine, SPA Router, Service Worker
   ========================================================================== */

/**
 * Service Worker Registration Handler
 * Non-blocking PWA service worker registration with update checking and error fallback.
 */
function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          if (registration && typeof registration.addEventListener === 'function') {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker && typeof newWorker.addEventListener === 'function') {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version available. Refresh to update.');
                  }
                });
              }
            });
          }
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed (app will operate normally):', error);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  } else {
    console.log('[PWA] Service Worker is not supported in this environment.');
  }
}

/**
 * Helper to query multiple single selectors safely across standard DOM and mock test environments.
 * @param {string[]} selectors Array of single CSS selectors
 * @returns {Element[]} Array of unique DOM elements
 */
function querySelectorAllMultiple(selectors) {
  if (typeof document === 'undefined') return [];
  const set = new Set();
  selectors.forEach((sel) => {
    try {
      const els = document.querySelectorAll(sel);
      if (els) {
        els.forEach((el) => set.add(el));
      }
    } catch (e) {}
  });
  return Array.from(set);
}

/**
 * Theme Engine Module
 * Manages dual theme states (light/dark), persistence, system preference synchronization,
 * status bar meta tags, and 'themechanged' event dispatching.
 */
const ThemeEngine = {
  STORAGE_KEY: 'theme',

  /**
   * Determine the current preferred theme.
   * Hierarchy: 1. localStorage -> 2. prefers-color-scheme -> 3. default ('light')
   * @returns {string} 'light' | 'dark'
   */
  getPreferredTheme() {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          return savedTheme;
        }
      }
    } catch (e) {
      console.warn('[ThemeEngine] LocalStorage access failed:', e);
    }

    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  },

  /**
   * Apply target theme to documentElement and notify dependent components.
   * @param {string} theme - 'light' | 'dark'
   * @param {boolean} persist - Whether to store theme setting in localStorage
   */
  setTheme(theme, persist = false) {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', validTheme);
      
      // Update theme-color meta tag for browser status bar framing
      const themeMeta = document.getElementById('theme-color-meta');
      if (themeMeta) {
        themeMeta.setAttribute('content', validTheme === 'dark' ? '#0f172a' : '#4f46e5');
      }
    }

    if (persist) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.STORAGE_KEY, validTheme);
        }
      } catch (e) {
        console.warn('[ThemeEngine] Failed to save theme to localStorage:', e);
      }
    }

    this.updateToggleUI(validTheme);

    // Dispatch custom 'themechanged' event for downstream components (e.g., Chart.js scheme updates)
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('themechanged', {
        detail: { theme: validTheme }
      }));
    }
  },

  /**
   * Toggle between light and dark modes and persist setting.
   */
  toggleTheme() {
    const currentTheme = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || this.getPreferredTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme, true);
  },

  /**
   * Synchronize theme toggle button icons and accessible labels.
   * @param {string} theme - 'light' | 'dark'
   */
  updateToggleUI(theme) {
    if (typeof document === 'undefined') return;

    const toggleBtns = querySelectorAllMultiple(['#theme-toggle', '[data-action="toggle-theme"]']);
    toggleBtns.forEach((btn) => {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
      
      const iconEl = btn.querySelector ? btn.querySelector('.theme-icon') : null;
      if (iconEl) {
        iconEl.textContent = isDark ? '☀️' : '🌙';
      }
    });
  },

  /**
   * Initialize Theme Engine
   */
  init() {
    const initialTheme = this.getPreferredTheme();
    this.setTheme(initialTheme, false);

    // Synchronize OS prefers-color-scheme changes if user hasn't explicitly overridden preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSchemeChange = (e) => {
        let hasSavedPreference = false;
        try {
          hasSavedPreference = !!(typeof localStorage !== 'undefined' && localStorage.getItem(this.STORAGE_KEY));
        } catch (err) {}

        if (!hasSavedPreference) {
          this.setTheme(e.matches ? 'dark' : 'light', false);
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSchemeChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSchemeChange);
      }
    }

    // Attach click listener for theme toggle elements
    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        const toggleTarget = (target.closest ? target.closest('#theme-toggle, [data-action="toggle-theme"]') : null) ||
                             (target.id === 'theme-toggle' ? target : null);

        if (toggleTarget) {
          if (e.preventDefault) e.preventDefault();
          this.toggleTheme();
        }
      });
    }
  }
};

/**
 * SPA DOM View Router Module
 * Hash-based router supporting #transactions, #budget, #reports, and #settings.
 * Controls view panel visibility inside #main-content, updates navigation active state,
 * updates header title, and dispatches 'routechanged' events.
 */
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

  /**
   * Parse current route from location hash.
   * @returns {string} Valid route name
   */
  getCurrentRoute() {
    if (typeof window === 'undefined' || !window.location) {
      return this.DEFAULT_ROUTE;
    }
    const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return this.ROUTES.includes(hash) ? hash : this.DEFAULT_ROUTE;
  },

  /**
   * Navigate to specified target route.
   * @param {string} route 
   */
  navigateTo(route) {
    const targetRoute = this.ROUTES.includes(route) ? route : this.DEFAULT_ROUTE;
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = `#${targetRoute}`;
    }
  },

  /**
   * Render view corresponding to current route.
   */
  render() {
    if (typeof document === 'undefined') return;

    const activeRoute = this.getCurrentRoute();

    // 1. Update View Section Visibility inside #main-content
    const viewPanels = querySelectorAllMultiple(['.view-panel', '[data-view-content]', '[data-route]']);
    viewPanels.forEach((panel) => {
      const panelRoute = panel.getAttribute('data-route') || 
                         panel.getAttribute('data-view-content') || 
                         (panel.id ? panel.id.replace(/^view-/, '') : '');

      if (panelRoute === activeRoute) {
        if (panel.classList && panel.classList.add) panel.classList.add('active');
        if (panel.removeAttribute) panel.removeAttribute('hidden');
        if (panel.style) panel.style.display = 'block';
      } else {
        if (panel.classList && panel.classList.remove) panel.classList.remove('active');
        if (panel.setAttribute) panel.setAttribute('hidden', '');
        if (panel.style) panel.style.display = 'none';
      }
    });

    // 2. Update Header View Title
    const viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl) {
      viewTitleEl.textContent = this.TITLES[activeRoute] || 'Giao dịch';
    }

    // 3. Update Navigation Links Active States
    const navLinks = querySelectorAllMultiple(['.nav-link', '[data-view]', '[role="tab"]']);
    navLinks.forEach((link) => {
      const linkRoute = link.getAttribute('data-view') || 
                        (link.getAttribute('href') ? link.getAttribute('href').replace(/^#\/?/, '').trim() : '') ||
                        (link.id ? link.id.replace(/^nav-/, '') : '');

      const isActive = linkRoute === activeRoute;

      if (isActive) {
        if (link.classList && link.classList.add) link.classList.add('active');
        if (link.setAttribute) link.setAttribute('aria-selected', 'true');
      } else {
        if (link.classList && link.classList.remove) link.classList.remove('active');
        if (link.setAttribute) link.setAttribute('aria-selected', 'false');
      }
    });

    // 4. Dispatch Custom 'routechanged' Event for Downstream Modules
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('routechanged', {
        detail: { route: activeRoute }
      }));
    }

    // 5. Execute Registered Route Lifecycle Hook
    if (typeof this.hooks[activeRoute] === 'function') {
      try {
        this.hooks[activeRoute]();
      } catch (err) {
        console.error(`[Router] Error executing hook for route '${activeRoute}':`, err);
      }
    }
  },

  /**
   * Register a route lifecycle callback hook.
   * @param {string} route 
   * @param {Function} callback 
   */
  on(route, callback) {
    if (this.ROUTES.includes(route) && typeof callback === 'function') {
      this.hooks[route] = callback;
    }
  },

  /**
   * Initialize Router
   */
  init() {
    if (typeof window === 'undefined') return;

    // Default to initial route hash if missing
    if (!window.location.hash) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${this.DEFAULT_ROUTE}`);
      } else {
        window.location.hash = `#${this.DEFAULT_ROUTE}`;
      }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.render());

    // Perform initial render
    this.render();
  }
};

/**
 * Master Application Initializer
 */
const App = {
  init() {
    try {
      console.log('[App] Initializing Sổ Thu Chi PWA App Shell...');

      // 1. Initialize Theme Engine (applies data-theme to documentElement)
      ThemeEngine.init();

      // 2. Register Router lifecycle hooks for M3
      Router.on('budget', () => {
        const historyUI = typeof window !== 'undefined' ? (window.HistoryUI || window.HistoryManager) : null;
        if (historyUI && typeof historyUI.init === 'function') {
          historyUI.init();
        } else if (historyUI && typeof historyUI.render === 'function') {
          historyUI.render();
        }
      });

      Router.on('reports', () => {
        const chartsUI = typeof window !== 'undefined' ? (window.ChartsUI || window.Charts || window.ChartManager) : null;
        if (chartsUI && typeof chartsUI.init === 'function') {
          chartsUI.init();
        } else if (chartsUI && typeof chartsUI.renderCharts === 'function') {
          chartsUI.renderCharts();
        }
      });

      // Initialize SPA Router (activates view panel based on hash)
      Router.init();

      // 3. Register Service Worker
      registerServiceWorker();

      // 4. Initialize Transaction Form Component
      TransactionForm.init();

      // 5. Initialize History, Charts & Category Tree event listeners
      const historyUI = typeof window !== 'undefined' ? (window.HistoryUI || window.HistoryManager) : null;
      if (historyUI && typeof historyUI.initEventListeners === 'function') {
        historyUI.initEventListeners();
      }
      const chartsUI = typeof window !== 'undefined' ? (window.ChartsUI || window.Charts || window.ChartManager) : null;
      if (chartsUI && typeof chartsUI.initEventListeners === 'function') {
        chartsUI.initEventListeners();
      }
      if (typeof CategoryTreeManager !== 'undefined' && typeof CategoryTreeManager.initEventListeners === 'function') {
        CategoryTreeManager.initEventListeners();
      }

      console.log('[App] App Shell initialization complete.');
    } catch (err) {
      console.warn('[App] Non-fatal App Shell initialization warning:', err);
    }
  }
};

/**
 * Toast Notification System
 */
const Toast = {
  show(message, type = 'info', duration = 3000) {
    if (typeof document === 'undefined') return;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      if (document.body) document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;

    if (container.appendChild) {
      container.appendChild(toast);
    }

    setTimeout(() => {
      if (toast.classList && toast.classList.add) toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode && typeof toast.parentNode.removeChild === 'function') {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
};

/**
 * Currency Formatting & Parsing Helpers
 */
function parseRawAmount(inputStr) {
  if (inputStr === null || inputStr === undefined) return 0;
  const cleaned = String(inputStr).replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function formatVNDInput(value) {
  const numeric = parseRawAmount(value);
  if (!numeric || isNaN(numeric)) return '';
  return numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Quick Transaction Entry Form Handler
 */
const TransactionForm = {
  getDefaultDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getCurrentType() {
    if (typeof document === 'undefined') return 'expense';
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    return checkedRadio ? checkedRadio.value : 'expense';
  },

  populateCategories(type) {
    if (typeof document === 'undefined') return;
    const selectEl = document.getElementById('input-category');
    if (!selectEl) return;

    type = type || this.getCurrentType();

    let categories = [];
    if (typeof window !== 'undefined' && window.Categories && typeof window.Categories.getActive === 'function') {
      categories = window.Categories.getActive(type);
    } else if (typeof window !== 'undefined' && window.CategoryManager && typeof window.CategoryManager.getActive === 'function') {
      categories = window.CategoryManager.getActive(type);
    } else if (typeof window !== 'undefined' && window.DB && typeof window.DB.getCategories === 'function') {
      categories = window.DB.getCategories(false).filter(c => c.type === type);
    }

    selectEl.innerHTML = '<option value="" disabled selected>-- Chọn hạng mục --</option>';

    if (!categories || categories.length === 0) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.disabled = true;
      emptyOpt.textContent = 'Chưa có hạng mục nào';
      selectEl.appendChild(emptyOpt);
      return;
    }

    const groupsMap = new Map();
    categories.forEach(cat => {
      const gName = cat.group || 'Khác';
      if (!groupsMap.has(gName)) {
        groupsMap.set(gName, []);
      }
      groupsMap.get(gName).push(cat);
    });

    groupsMap.forEach((catList, gName) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = gName;
      catList.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = `${cat.icon ? cat.icon + ' ' : ''}${cat.name}`;
        optgroup.appendChild(opt);
      });
      selectEl.appendChild(optgroup);
    });

    if (categories.length > 0) {
      selectEl.value = categories[0].name;
    }
  },

  initDatePicker() {
    if (typeof document === 'undefined') return;
    const dateInput = document.getElementById('input-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = this.getDefaultDateString();
    }
  },

  resetForm() {
    if (typeof document === 'undefined') return;

    const form = document.getElementById('transaction-form');
    if (form && typeof form.reset === 'function') {
      form.reset();
    }

    const amountInput = document.getElementById('input-amount');
    if (amountInput) amountInput.value = '';

    const noteInput = document.getElementById('input-note');
    if (noteInput) noteInput.value = '';

    const expenseRadio = document.getElementById('type-expense');
    if (expenseRadio) expenseRadio.checked = true;

    this.initDatePicker();
    this.populateCategories('expense');
  },

  handleAmountInput(e) {
    if (!e || !e.target) return;
    const input = e.target;
    const rawValue = input.value;
    const cursorPosition = input.selectionStart || rawValue.length;
    const originalLength = rawValue.length;

    const formatted = formatVNDInput(rawValue);
    input.value = formatted;

    if (typeof input.setSelectionRange === 'function') {
      const newLength = formatted.length;
      const newPosition = Math.max(0, cursorPosition + (newLength - originalLength));
      try {
        input.setSelectionRange(newPosition, newPosition);
      } catch (err) {}
    }
  },

  handleSubmit(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (typeof document === 'undefined') return null;

    const type = this.getCurrentType();
    const amountInput = document.getElementById('input-amount');
    const rawAmountStr = amountInput ? amountInput.value : '';
    const amount = parseRawAmount(rawAmountStr);
    const categorySelect = document.getElementById('input-category');
    const category = categorySelect ? categorySelect.value : '';
    const dateInput = document.getElementById('input-date');
    const date = (dateInput && dateInput.value) ? dateInput.value : this.getDefaultDateString();
    const noteInput = document.getElementById('input-note');
    const note = (noteInput ? noteInput.value : '').trim();

    if (isNaN(amount) || amount <= 0) {
      Toast.show('Số tiền phải là số dương hợp lệ', 'error');
      throw new Error('Số tiền phải là số dương hợp lệ');
    }

    if (!category) {
      Toast.show('Vui lòng chọn hạng mục', 'warning');
      return null;
    }

    const dbObj = (typeof window !== 'undefined' && (window.DB || window.db));
    if (!dbObj || typeof dbObj.addTransaction !== 'function') {
      console.error('[TransactionForm] DB.addTransaction is not available.');
      Toast.show('Lỗi hệ thống: Chưa khởi tạo cơ sở dữ liệu!', 'error');
      return null;
    }

    const transactionData = {
      type: type,
      amount: amount,
      category: category,
      date: date,
      note: note
    };

    const newTx = dbObj.addTransaction(transactionData);

    const formattedVND = typeof window !== 'undefined' && typeof window.formatVND === 'function'
      ? window.formatVND(amount)
      : amount + ' ₫';

    Toast.show(`Đã thêm ${type === 'expense' ? 'chi tiêu' : 'thu nhập'} ${formattedVND}!`, 'success');
    this.resetForm();
    this.updateDashboardStats();

    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('transactionadded', { detail: { transaction: newTx } }));
      } catch (err) {}
    }

    return newTx;
  },

  init() {
    if (typeof document === 'undefined') return;

    this.initDatePicker();
    this.populateCategories(this.getCurrentType());

    // Attach type switcher change listeners
    const typeRadios = document.querySelectorAll('input[name="tx-type"]');
    if (typeRadios) {
      typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.populateCategories(e.target.value);
        });
      });
    }

    // Attach amount input formatter listener
    const amountInput = document.getElementById('input-amount');
    if (amountInput) {
      amountInput.addEventListener('input', (e) => this.handleAmountInput(e));
    }

    // Attach form submit listener
    const form = document.getElementById('transaction-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Attach reset button listener
    const resetBtn = document.getElementById('btn-reset-tx');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetForm());
    }

    // Listen for category, auth, and transaction data sync updates
    if (typeof window !== 'undefined') {
      window.addEventListener('categorieschanged', () => {
        this.populateCategories(this.getCurrentType());
      });
      window.addEventListener('authchanged', () => {
        this.updateDashboardStats();
      });

      ['transactionschanged', 'transactionadded', 'transactionupdated', 'transactiondeleted'].forEach(evt => {
        window.addEventListener(evt, () => {
          this.updateDashboardStats();
        });
      });
    }

    this.updateDashboardStats();
  },

  updateDashboardStats() {
    if (typeof document === 'undefined') return;
    const db = typeof window !== 'undefined' ? window.DB : null;
    if (!db) return;

    const txs = db.getTransactions();
    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    });

    const balance = totalIncome - totalExpense;

    const elBalance = document.getElementById('dash-balance-amount');
    const elIncome = document.getElementById('dash-income-amount');
    const elExpense = document.getElementById('dash-expense-amount');

    const fmtVND = (db && typeof db.formatVND === 'function') ? (n => db.formatVND(n)) : (typeof formatVND === 'function' ? formatVND : (n => Number(n).toLocaleString('vi-VN') + ' ₫'));

    if (elBalance) elBalance.textContent = fmtVND(balance);
    if (elIncome) elIncome.textContent = fmtVND(totalIncome);
    if (elExpense) elExpense.textContent = fmtVND(totalExpense);

    const user = (typeof window !== 'undefined' && window.Auth) ? window.Auth.getUser() : null;
    const elUser = document.getElementById('hero-user-name');
    if (elUser && user && user.name) {
      elUser.textContent = user.name;
    }
  }
};

/**
 * 3-Tier Category Tree Manager & Modal Handlers
 */
const CategoryTreeManager = {
  renderTree() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('category-manager-tree');
    if (!container) return;

    const catMgr = typeof window !== 'undefined' ? (window.CategoryManager || window.Categories) : null;
    if (!catMgr || typeof catMgr.getGroups !== 'function') return;

    const groups = catMgr.getGroups();
    const categories = catMgr.getCategories(true);

    let html = '';

    groups.forEach(group => {
      const subcats = categories.filter(c => c.group === group.name || c.groupId === group.id);
      const isExpense = group.type === 'expense';
      const badgeStyle = isExpense ? 'background: rgba(239, 68, 68, 0.1); color: #ef4444;' : 'background: rgba(16, 185, 129, 0.1); color: #10b981;';
      const badgeText = isExpense ? 'Chi tiêu' : 'Thu nhập';

      html += `
        <div class="category-group-card" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; background: var(--bg-card-subtle, rgba(0,0,0,0.01));">
          <div class="group-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">${group.icon || '📁'}</span>
              <strong style="color: var(--text-primary, #0f172a); font-size: 0.95rem;">${group.name}</strong>
              <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 500; ${badgeStyle}">${badgeText}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-xs btn-add-subcat-fast" data-group-name="${group.name}" data-group-type="${group.type}" title="Thêm hạng mục con vào nhóm này" style="padding: 2px 8px; font-size: 0.8rem;">+ Con</button>
          </div>
          <div class="subcategories-pills-list" style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
      `;

      if (subcats.length === 0) {
        html += `<span style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">Chưa có hạng mục con</span>`;
      } else {
        subcats.forEach(sub => {
          const isHidden = sub.isHidden || sub.is_hidden;
          const hideStyle = isHidden ? 'opacity: 0.4; text-decoration: line-through;' : '';
          html += `
            <span class="subcat-pill" style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 3px 8px; background: var(--bg-surface, #fff); border: 1px solid var(--border-color, #cbd5e1); border-radius: 16px; font-size: 0.85rem; ${hideStyle}">
              <span>${sub.icon || '✨'}</span>
              <span>${sub.name}</span>
              <button type="button" class="btn-toggle-cat-hide" data-cat-id="${sub.id}" style="background: none; border: none; cursor: pointer; padding: 0 2px; font-size: 0.75rem; opacity: 0.7;" title="${isHidden ? 'Hiện hạng mục' : 'Ẩn hạng mục'}">
                ${isHidden ? '👁️' : '🙈'}
              </button>
            </span>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  populateAddCatGroups(type) {
    if (typeof document === 'undefined') return;
    const selectEl = document.getElementById('add-cat-group');
    if (!selectEl) return;
    type = type || 'expense';
    const catMgr = typeof window !== 'undefined' ? (window.CategoryManager || window.Categories) : null;
    const groups = catMgr && typeof catMgr.getGroups === 'function' ? catMgr.getGroups(type) : [];
    selectEl.innerHTML = '';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.name;
      opt.textContent = `${g.icon ? g.icon + ' ' : ''}${g.name}`;
      selectEl.appendChild(opt);
    });
  },

  initEventListeners() {
    if (typeof document === 'undefined') return;

    this.renderTree();

    // Fast add subcat button inside group card & toggle hide buttons
    document.addEventListener('click', (e) => {
      const fastBtn = e.target.closest ? e.target.closest('.btn-add-subcat-fast') : null;
      if (fastBtn) {
        const groupName = fastBtn.getAttribute('data-group-name');
        const groupType = fastBtn.getAttribute('data-group-type');
        const modal = document.getElementById('modal-add-cat');
        const typeSelect = document.getElementById('add-cat-type');
        if (typeSelect) {
          typeSelect.value = groupType || 'expense';
        }
        this.populateAddCatGroups(groupType);
        const groupSelect = document.getElementById('add-cat-group');
        if (groupSelect && groupName) {
          groupSelect.value = groupName;
        }
        if (modal) {
          modal.removeAttribute('hidden');
          modal.setAttribute('aria-hidden', 'false');
        }
        return;
      }

      const hideBtn = e.target.closest ? e.target.closest('.btn-toggle-cat-hide') : null;
      if (hideBtn) {
        const catId = hideBtn.getAttribute('data-cat-id');
        const catMgr = window.CategoryManager || window.Categories;
        if (catId && catMgr && typeof catMgr.toggleHideCategory === 'function') {
          try {
            catMgr.toggleHideCategory(catId);
            this.renderTree();
            if (window.Toast) window.Toast.show('Đã cập nhật trạng thái hạng mục', 'success');
          } catch (err) {
            if (window.Toast) window.Toast.show(err.message || 'Không thể cập nhật hạng mục', 'error');
          }
        }
        return;
      }

      // Close modal buttons with data-close-modal
      const closeBtn = e.target.closest ? e.target.closest('[data-close-modal]') : null;
      if (closeBtn) {
        const modalTarget = closeBtn.getAttribute('data-close-modal');
        if (modalTarget === 'add-group') {
          const modal = document.getElementById('modal-add-group');
          if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
        } else if (modalTarget === 'add-cat') {
          const modal = document.getElementById('modal-add-cat');
          if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
        }
      }
    });

    // Open add group modal button
    const btnOpenGroup = document.getElementById('btn-open-add-group');
    if (btnOpenGroup) {
      btnOpenGroup.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-group');
        if (modal) {
          modal.removeAttribute('hidden');
          modal.setAttribute('aria-hidden', 'false');
        }
      });
    }

    // Open add subcategory modal button
    const btnOpenCat = document.getElementById('btn-open-add-cat');
    if (btnOpenCat) {
      btnOpenCat.addEventListener('click', () => {
        const typeSelect = document.getElementById('add-cat-type');
        const currentType = typeSelect ? typeSelect.value : 'expense';
        this.populateAddCatGroups(currentType);
        const modal = document.getElementById('modal-add-cat');
        if (modal) {
          modal.removeAttribute('hidden');
          modal.setAttribute('aria-hidden', 'false');
        }
      });
    }

    // Dynamic group option update when type changes in add subcat form
    const addCatTypeSelect = document.getElementById('add-cat-type');
    if (addCatTypeSelect) {
      addCatTypeSelect.addEventListener('change', (e) => {
        this.populateAddCatGroups(e.target.value);
      });
    }

    // Submit Add Group Form
    const formAddGroup = document.getElementById('form-add-group');
    if (formAddGroup) {
      formAddGroup.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('add-group-type')?.value || 'expense';
        const name = document.getElementById('add-group-name')?.value?.trim();
        const icon = document.getElementById('add-group-icon')?.value?.trim() || '📁';

        if (!name) {
          if (window.Toast) window.Toast.show('Tên nhóm không được để trống', 'error');
          return;
        }

        try {
          const catMgr = window.CategoryManager || window.Categories;
          if (catMgr && typeof catMgr.addGroup === 'function') {
            catMgr.addGroup({ name, type, icon, color: type === 'income' ? '#10b981' : '#ef4444' });
            if (window.Toast) window.Toast.show(`Đã thêm nhóm chính "${name}"`, 'success');
            formAddGroup.reset();
            const modal = document.getElementById('modal-add-group');
            if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
            this.renderTree();
          }
        } catch (err) {
          if (window.Toast) window.Toast.show(err.message || 'Lỗi thêm nhóm chính', 'error');
        }
      });
    }

    // Submit Add Subcategory Form
    const formAddCat = document.getElementById('form-add-cat');
    if (formAddCat) {
      formAddCat.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('add-cat-type')?.value || 'expense';
        const group = document.getElementById('add-cat-group')?.value;
        const name = document.getElementById('add-cat-name')?.value?.trim();
        const icon = document.getElementById('add-cat-icon')?.value?.trim() || '✨';

        if (!name) {
          if (window.Toast) window.Toast.show('Tên hạng mục con không được để trống', 'error');
          return;
        }

        try {
          const catMgr = window.CategoryManager || window.Categories;
          if (catMgr && typeof catMgr.addCategory === 'function') {
            catMgr.addCategory({ name, group, type, icon, color: type === 'income' ? '#10b981' : '#ef4444' });
            if (window.Toast) window.Toast.show(`Đã thêm hạng mục con "${name}"`, 'success');
            formAddCat.reset();
            const modal = document.getElementById('modal-add-cat');
            if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
            this.renderTree();
          }
        } catch (err) {
          if (window.Toast) window.Toast.show(err.message || 'Lỗi thêm hạng mục con', 'error');
        }
      });
    }

    // Listen to categorieschanged event
    if (typeof window !== 'undefined') {
      window.addEventListener('categorieschanged', () => {
        this.renderTree();
      });
    }
  }
};

// Global exports for downstream modules and test runner
if (typeof window !== 'undefined') {
  window.App = App;
  window.ThemeEngine = ThemeEngine;
  window.Router = Router;
  window.TransactionForm = TransactionForm;
  window.CategoryTreeManager = CategoryTreeManager;
  window.Toast = Toast;
  window.parseRawAmount = parseRawAmount;
  window.formatVNDInput = formatVNDInput;
}
if (typeof globalThis !== 'undefined') {
  globalThis.App = App;
  globalThis.ThemeEngine = ThemeEngine;
  globalThis.Router = Router;
  globalThis.TransactionForm = TransactionForm;
  globalThis.CategoryTreeManager = CategoryTreeManager;
  globalThis.Toast = Toast;
  globalThis.parseRawAmount = parseRawAmount;
  globalThis.formatVNDInput = formatVNDInput;
}
if (typeof this !== 'undefined' && this) {
  this.App = App;
  this.ThemeEngine = ThemeEngine;
  this.Router = Router;
  this.TransactionForm = TransactionForm;
  this.CategoryTreeManager = CategoryTreeManager;
  this.Toast = Toast;
  this.parseRawAmount = parseRawAmount;
  this.formatVNDInput = formatVNDInput;
}

// Global Entry Point: Execute initialization on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
}
