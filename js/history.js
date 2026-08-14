/**
 * js/history.js - Transaction History & Filter/Search Manager
 * Handles transaction history listing, date/month grouping, keyword search (300ms debounce),
 * category filtering, date range filtering presets, pagination, and edit/delete modals.
 */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function getDB() {
    if (typeof globalThis !== 'undefined' && globalThis.DB) return globalThis.DB;
    if (typeof window !== 'undefined' && window.DB) return window.DB;
    if (typeof global !== 'undefined' && global.DB) return global.DB;
    return global.DB || (global.window && global.window.DB);
  }

  function getCatMgr() {
    if (typeof globalThis !== 'undefined' && (globalThis.CategoryManager || globalThis.Categories)) {
      return globalThis.CategoryManager || globalThis.Categories;
    }
    if (typeof window !== 'undefined' && (window.CategoryManager || window.Categories)) {
      return window.CategoryManager || window.Categories;
    }
    return global.CategoryManager || global.Categories ||
      (global.window && (global.window.CategoryManager || global.window.Categories));
  }

  function formatVND(n) {
    const db = getDB();
    if (db && db.formatVND) return db.formatVND(n);
    if (global.formatVND) return global.formatVND(n);
    return Number(n).toLocaleString('vi-VN') + ' ₫';
  }

  /** Get icon for a category name from CategoryManager */
  function getCatIcon(catName, type) {
    const mgr = getCatMgr();
    if (mgr && typeof mgr.getCategories === 'function') {
      const all = mgr.getCategories(true);
      const found = all.find(c => c.name === catName);
      if (found && found.icon) return found.icon;
    }
    return type === 'income' ? '💰' : '💸';
  }

  /** Escape HTML for XSS prevention */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ------------------------------------------------------------------
     HistoryManager Class
     ------------------------------------------------------------------ */
  class HistoryManager {
    constructor() {
      this.currentFilters = {
        query: '',
        category: 'all',
        type: 'all',
        wallet: 'all',
        startDate: '',
        endDate: '',
        preset: 'this_month'
      };
      this.pagination = {
        pageSize: 20,
        visibleCount: 20
      };
      this.activeEditId = null;
      this.activeDeleteId = null;
      this.debounceTimer = null;
      this.isInitialized = false;
    }

    /* ----------------------------------------------------------------
       Filter Logic
       ---------------------------------------------------------------- */
    filterTransactions(overrides = {}) {
      const db = getDB();
      let txs = db && typeof db.getTransactions === 'function'
        ? db.getTransactions()
        : [];

      // Exclude soft-deleted
      txs = txs.filter(t => t.sync_status !== 'pending_delete');

      const f = { ...this.currentFilters, ...overrides };
      const query = (f.query || '').trim().toLowerCase();
      const { category, type, wallet, wallet_id, wallet_name, startDate, endDate } = f;

      // Inverted date range → empty
      if (startDate && endDate && startDate > endDate) return [];

      const targetWallet = wallet_id && wallet_id !== 'all' ? wallet_id : (wallet && wallet !== 'all' ? wallet : null);

      return txs.filter(tx => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        if (type && type !== 'all' && tx.type !== type) return false;
        if (targetWallet && targetWallet !== 'all') {
          const txWalletId = tx.wallet_id || 'wallet_cash';
          const txWalletName = tx.wallet_name || 'Ví tiền mặt';
          if (txWalletId !== targetWallet && txWalletName !== targetWallet) return false;
        }
        if (wallet_name && wallet_name !== 'all') {
          const txWalletName = tx.wallet_name || 'Ví tiền mặt';
          const txWalletId = tx.wallet_id || 'wallet_cash';
          if (txWalletName !== wallet_name && txWalletId !== wallet_name) return false;
        }

        // Category filter: match subcategory name or group name
        if (category && category !== 'all') {
          const mgr = getCatMgr();
          const matchesCat = tx.category === category;
          let matchesGroup = false;
          if (mgr && typeof mgr.getCategories === 'function') {
            const catObj = mgr.getCategories(true).find(c => c.name === tx.category);
            matchesGroup = !!(catObj && (catObj.group === category || catObj.groupId === category));
          }
          if (!matchesCat && !matchesGroup) return false;
        }

        // Keyword search: note, category, group, amount (raw & formatted), date, wallet_name
        if (query) {
          const noteText = (tx.note || '').toLowerCase();
          const catText = (tx.category || '').toLowerCase();
          const walletText = (tx.wallet_name || '').toLowerCase();
          const walletIdText = (tx.wallet_id || '').toLowerCase();
          const amountRaw = String(tx.amount || '');
          // also match formatted VND like "50.000"
          const amountFmt = formatVND(tx.amount).replace(/[^\d.]/g, '').toLowerCase();
          const dateText = (tx.date || '');

          let groupText = '';
          const mgr = getCatMgr();
          if (mgr && typeof mgr.getCategories === 'function') {
            const catObj = mgr.getCategories(true).find(c => c.name === tx.category);
            groupText = catObj ? (catObj.group || '').toLowerCase() : '';
          }

          const matched =
            noteText.includes(query) ||
            catText.includes(query) ||
            walletText.includes(query) ||
            walletIdText.includes(query) ||
            groupText.includes(query) ||
            amountRaw.includes(query.replace(/\./g, '')) ||
            amountFmt.includes(query) ||
            dateText.includes(query);

          if (!matched) return false;
        }

        return true;
      });
    }

    /* ----------------------------------------------------------------
       Group by date
       ---------------------------------------------------------------- */
    groupByDate(transactions) {
      const map = {};
      transactions.forEach(tx => {
        const key = tx.date || 'Khác';
        if (!map[key]) {
          map[key] = { date: key, transactions: [], totalIncome: 0, totalExpense: 0, netTotal: 0 };
        }
        map[key].transactions.push(tx);
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') map[key].totalIncome += amt;
        else map[key].totalExpense += amt;
        map[key].netTotal = map[key].totalIncome - map[key].totalExpense;
      });
      return Object.keys(map)
        .sort((a, b) => b.localeCompare(a))
        .map(k => map[k]);
    }

    groupTransactionsByDate(transactions) {
      return this.groupByDate(transactions);
    }

    /* ----------------------------------------------------------------
       Populate category filter dropdown
       ---------------------------------------------------------------- */
    populateCategories() {
      const selectEl = document.getElementById('filter-category');
      if (!selectEl) return;

      const savedVal = this.currentFilters.category || 'all';
      selectEl.innerHTML = '<option value="all">Tất cả hạng mục</option>';

      const mgr = getCatMgr();
      let categories = [];
      if (mgr && typeof mgr.getCategories === 'function') {
        categories = mgr.getCategories(true);
      } else {
        const db = getDB();
        if (db && typeof db.getCategories === 'function') {
          categories = db.getCategories(true);
        }
      }

      // Group by group name
      const groups = new Map();
      categories.forEach(cat => {
        const g = cat.group || 'Khác';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(cat);
      });

      groups.forEach((list, gName) => {
        const og = document.createElement('optgroup');
        og.label = gName;
        list.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = `${cat.icon ? cat.icon + ' ' : ''}${cat.name}${cat.isHidden || cat.is_hidden ? ' (Đã ẩn)' : ''}`;
          og.appendChild(opt);
        });
        selectEl.appendChild(og);
      });

      // Restore selected value
      selectEl.value = savedVal;
    }

    /* ----------------------------------------------------------------
       Date preset
       ---------------------------------------------------------------- */
    applyDatePreset(key) {
      this.currentFilters.preset = key;
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      let start = '', end = '';

      const formatYMD = global.formatLocalYMD || (d => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });

      if (key === 'this_month') {
        start = formatYMD(new Date(y, m, 1));
        end = formatYMD(new Date(y, m + 1, 0));
      } else if (key === 'last_month') {
        start = formatYMD(new Date(y, m - 1, 1));
        end = formatYMD(new Date(y, m, 0));
      } else if (key === 'this_year') {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
      }
      // 'all' and 'custom' leave start/end empty

      if (key !== 'custom') {
        this.currentFilters.startDate = start;
        this.currentFilters.endDate = end;
        const startEl = document.getElementById('filter-start-date');
        const endEl = document.getElementById('filter-end-date');
        if (startEl) startEl.value = start;
        if (endEl) endEl.value = end;
      }
    }

    /* ----------------------------------------------------------------
       Render history list
       ---------------------------------------------------------------- */
    renderHistoryList(transactions, container) {
      container = container || document.getElementById('history-list-container');
      if (!container) return;

      const loadMoreBtn = document.getElementById('btn-load-more');
      const loadMoreCount = document.getElementById('load-more-count');

      if (!transactions || transactions.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>Không tìm thấy giao dịch nào</p>
            <p class="empty-hint">Thử thay đổi bộ lọc hoặc khoảng thời gian</p>
          </div>`;
        if (loadMoreBtn) loadMoreBtn.hidden = true;
        return;
      }

      const total = transactions.length;
      const visible = transactions.slice(0, this.pagination.visibleCount);
      const remaining = total - visible.length;

      if (loadMoreBtn) {
        loadMoreBtn.hidden = remaining <= 0;
        if (loadMoreCount) {
          loadMoreCount.textContent = remaining > 0 ? `(Còn ${remaining} giao dịch)` : '';
        }
      }

      const groups = this.groupByDate(visible);
      let html = '';

      groups.forEach(group => {
        const dateLabel = this._formatDateLabel(group.date);
        html += `
          <div class="history-group">
            <div class="history-group-header">
              <span class="group-date">${escapeHTML(dateLabel)}</span>
              <span class="group-totals">
                ${group.totalIncome > 0 ? `<span class="income-badge">+${formatVND(group.totalIncome)}</span>` : ''}
                ${group.totalExpense > 0 ? `<span class="expense-badge">-${formatVND(group.totalExpense)}</span>` : ''}
              </span>
            </div>
            <div class="history-group-items">`;

        group.transactions.forEach(tx => {
          const isIncome = tx.type === 'income';
          const icon = getCatIcon(tx.category, tx.type);
          html += `
            <div class="history-item ${isIncome ? 'income' : 'expense'}" data-id="${tx.id}">
              <div class="item-icon">${icon}</div>
              <div class="item-details">
                <div class="item-category">${escapeHTML(tx.category || 'Khác')}</div>
                ${tx.note ? `<div class="item-note">${escapeHTML(tx.note)}</div>` : ''}
              </div>
              <div class="item-right">
                <div class="item-amount ${isIncome ? 'income-text' : 'expense-text'}">
                  ${isIncome ? '+' : '-'}${formatVND(tx.amount)}
                </div>
                <div class="item-actions">
                  <button type="button" class="btn-icon edit-tx" data-id="${tx.id}" title="Sửa" aria-label="Sửa giao dịch">✏️</button>
                  <button type="button" class="btn-icon delete-tx" data-id="${tx.id}" title="Xóa" aria-label="Xóa giao dịch">🗑️</button>
                </div>
              </div>
            </div>`;
        });

        html += `</div></div>`;
      });

      container.innerHTML = html;
    }

    /** Format date string YYYY-MM-DD → readable Vietnamese label */
    _formatDateLabel(dateStr) {
      if (!dateStr || dateStr === 'Khác') return dateStr;
      try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return `${weekdays[date.getDay()]}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
      } catch (_) {
        return dateStr;
      }
    }

    /* ----------------------------------------------------------------
       Edit Modal
       ---------------------------------------------------------------- */
    openEditModal(id) {
      const db = getDB();
      if (!db) return;
      const tx = db.getTransactions({ includeDeleted: false }).find(t => t.id === id);
      if (!tx) return;

      this.activeEditId = id;
      const modal = document.getElementById('modal-edit-tx');
      if (!modal) return;

      document.getElementById('edit-tx-id').value = tx.id;
      const expenseRadio = document.getElementById('edit-type-expense');
      const incomeRadio = document.getElementById('edit-type-income');
      if (tx.type === 'income') { if (incomeRadio) incomeRadio.checked = true; }
      else { if (expenseRadio) expenseRadio.checked = true; }

      const fmtInput = global.formatVNDInput || (v => v ? Number(v).toLocaleString('vi-VN') : '');
      const amtEl = document.getElementById('edit-tx-amount');
      if (amtEl) amtEl.value = fmtInput(tx.amount);
      const dateEl = document.getElementById('edit-tx-date');
      if (dateEl) dateEl.value = tx.date;
      const noteEl = document.getElementById('edit-tx-note');
      if (noteEl) noteEl.value = tx.note || '';

      // Update words in edit modal
      const editWordsBox = document.getElementById('edit-amount-in-words');
      if (editWordsBox) {
        const toWords = global.numberToVietnameseWords || window.numberToVietnameseWords;
        const words = typeof toWords === 'function' ? toWords(tx.amount) : '';
        if (words) {
          editWordsBox.innerHTML = `<span class="words-icon">🗣️</span> <span>Bằng chữ: <strong>${words}</strong></span>`;
          editWordsBox.removeAttribute('hidden');
          editWordsBox.style.display = 'flex';
        } else {
          editWordsBox.setAttribute('hidden', '');
          editWordsBox.style.display = 'none';
          editWordsBox.innerHTML = '';
        }
      }

      this.populateEditCategories(tx.type, tx.category);

      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    populateEditCategories(type, selectedCat) {
      const selectEl = document.getElementById('edit-tx-category');
      if (!selectEl) return;

      // Always reset first
      selectEl.innerHTML = '';

      const mgr = getCatMgr();
      let categories = [];
      if (mgr && typeof mgr.getActive === 'function') {
        categories = mgr.getActive(type);
      } else {
        const db = getDB();
        if (db && typeof db.getCategories === 'function') {
          categories = db.getCategories(true).filter(c => !c.isHidden && !c.is_hidden && c.type === type);
        }
      }

      const groups = new Map();
      categories.forEach(cat => {
        const g = cat.group || 'Khác';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(cat);
      });

      groups.forEach((list, gName) => {
        const og = document.createElement('optgroup');
        og.label = gName;
        list.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = `${cat.icon ? cat.icon + ' ' : ''}${cat.name}`;
          og.appendChild(opt);
        });
        selectEl.appendChild(og);
      });

      // Ensure selected category exists even if hidden
      if (selectedCat && !categories.some(c => c.name === selectedCat)) {
        const opt = document.createElement('option');
        opt.value = selectedCat;
        opt.textContent = selectedCat;
        selectEl.appendChild(opt);
      }

      if (selectedCat) selectEl.value = selectedCat;
    }

    closeEditModal() {
      const modal = document.getElementById('modal-edit-tx');
      if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
      const editWordsBox = document.getElementById('edit-amount-in-words');
      if (editWordsBox) { editWordsBox.setAttribute('hidden', ''); editWordsBox.style.display = 'none'; editWordsBox.innerHTML = ''; }
      this.activeEditId = null;
    }

    handleSaveEdit(e) {
      e && e.preventDefault();
      const id = document.getElementById('edit-tx-id')?.value || this.activeEditId;
      if (!id) return;

      const typeRadio = document.querySelector('input[name="edit-tx-type"]:checked');
      const type = typeRadio ? typeRadio.value : 'expense';
      const parseRaw = global.parseRawAmount || (s => parseInt(String(s).replace(/\D/g,''), 10) || 0);
      const amount = parseRaw(document.getElementById('edit-tx-amount')?.value || '');
      const category = document.getElementById('edit-tx-category')?.value || '';
      const date = document.getElementById('edit-tx-date')?.value || '';
      const note = (document.getElementById('edit-tx-note')?.value || '').trim();

      if (!amount || amount <= 0) { global.Toast?.show('Số tiền phải lớn hơn 0', 'error'); return; }
      if (!category) { global.Toast?.show('Vui lòng chọn hạng mục', 'warning'); return; }

      const db = getDB();
      if (db && typeof db.updateTransaction === 'function') {
        db.updateTransaction(id, { type, amount, category, date, note });
        this.closeEditModal();
        global.Toast?.show('Đã cập nhật giao dịch thành công!', 'success');
        try { window.dispatchEvent(new CustomEvent('transactionupdated')); } catch (_) {}
        this.render();
      }
    }

    /* ----------------------------------------------------------------
       Delete Modal
       ---------------------------------------------------------------- */
    openDeleteModal(id) {
      const db = getDB();
      if (!db) return;
      const tx = db.getTransactions({ includeDeleted: false }).find(t => t.id === id);
      if (!tx) return;

      this.activeDeleteId = id;
      const modal = document.getElementById('modal-delete-tx');
      const summaryEl = document.getElementById('delete-tx-summary');
      if (!modal) return;

      if (summaryEl) {
        summaryEl.innerHTML = `
          <div><strong>Loại:</strong> ${tx.type === 'income' ? '💰 Thu nhập' : '💸 Chi tiêu'}</div>
          <div><strong>Hạng mục:</strong> ${escapeHTML(tx.category)}</div>
          <div><strong>Số tiền:</strong> ${formatVND(tx.amount)}</div>
          <div><strong>Ngày:</strong> ${escapeHTML(tx.date)}</div>
          ${tx.note ? `<div><strong>Ghi chú:</strong> ${escapeHTML(tx.note)}</div>` : ''}`;
      }

      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    closeDeleteModal() {
      const modal = document.getElementById('modal-delete-tx');
      if (modal) { modal.setAttribute('hidden', ''); modal.setAttribute('aria-hidden', 'true'); }
      this.activeDeleteId = null;
    }

    handleConfirmDelete() {
      if (!this.activeDeleteId) return;
      const id = this.activeDeleteId;
      const db = getDB();
      if (db && typeof db.deleteTransaction === 'function') {
        db.deleteTransaction(id);
        this.closeDeleteModal();
        global.Toast?.show('Đã xóa giao dịch!', 'info');
        try { window.dispatchEvent(new CustomEvent('transactiondeleted', { detail: { id } })); } catch (_) {}
        this.render();
      }
    }

    /* ----------------------------------------------------------------
       Render (main entry)
       ---------------------------------------------------------------- */
    render() {
      if (typeof document === 'undefined') return;
      this.populateCategories();
      const filtered = this.filterTransactions();
      this.renderHistoryList(filtered);
    }

    /* ----------------------------------------------------------------
       Event Listeners
       ---------------------------------------------------------------- */
    initEventListeners() {
      if (this.isInitialized || typeof document === 'undefined') return;
      this.isInitialized = true;

      // Search input (300ms debounce)
      const searchInput = document.getElementById('search-query');
      const clearBtn = document.getElementById('btn-clear-search');

      searchInput?.addEventListener('input', e => {
        const val = e.target.value;
        if (clearBtn) clearBtn.hidden = !val;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.currentFilters.query = val;
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        }, 300);
      });

      clearBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        clearBtn.hidden = true;
        this.currentFilters.query = '';
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      });

      // Type filter
      document.getElementById('filter-type')?.addEventListener('change', e => {
        this.currentFilters.type = e.target.value;
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      });

      // Category filter
      document.getElementById('filter-category')?.addEventListener('change', e => {
        this.currentFilters.category = e.target.value;
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      });

      // Wallet filter
      document.getElementById('filter-wallet')?.addEventListener('change', e => {
        this.currentFilters.wallet = e.target.value;
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      });

      // Date preset
      const presetSelect = document.getElementById('filter-date-preset');
      if (presetSelect) {
        this.applyDatePreset(presetSelect.value || 'this_month');
        presetSelect.addEventListener('change', e => {
          this.applyDatePreset(e.target.value);
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        });
      }

      // Custom date inputs
      const startEl = document.getElementById('filter-start-date');
      const endEl = document.getElementById('filter-end-date');
      const handleCustomDate = () => {
        if (presetSelect) presetSelect.value = 'custom';
        this.currentFilters.preset = 'custom';
        this.currentFilters.startDate = startEl?.value || '';
        this.currentFilters.endDate = endEl?.value || '';
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      };
      startEl?.addEventListener('change', handleCustomDate);
      endEl?.addEventListener('change', handleCustomDate);

      // Load more
      document.getElementById('btn-load-more')?.addEventListener('click', () => {
        this.pagination.visibleCount += this.pagination.pageSize;
        this.render();
      });

      // Edit / Delete delegation in history list
      document.getElementById('history-list-container')?.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-tx');
        if (editBtn) { this.openEditModal(editBtn.dataset.id); return; }
        const delBtn = e.target.closest('.delete-tx');
        if (delBtn) { this.openDeleteModal(delBtn.dataset.id); }
      });

      // Modal close buttons & backdrop
      document.addEventListener('click', e => {
        const closeBtn = e.target.closest('[data-close-modal]');
        if (closeBtn) {
          const target = closeBtn.dataset.closeModal;
          if (target === 'edit-tx') this.closeEditModal();
          if (target === 'delete-tx') this.closeDeleteModal();
          return;
        }
        if (e.target.classList?.contains('modal-backdrop')) {
          if (e.target.id === 'modal-edit-tx') this.closeEditModal();
          if (e.target.id === 'modal-delete-tx') this.closeDeleteModal();
        }
      });

      // Edit form submit
      document.getElementById('form-edit-tx')?.addEventListener('submit', e => this.handleSaveEdit(e));

      // Edit type radios
      document.querySelectorAll('input[name="edit-tx-type"]').forEach(r => {
        r.addEventListener('change', e => this.populateEditCategories(e.target.value));
      });

      // Edit amount formatter
      document.getElementById('edit-tx-amount')?.addEventListener('input', e => {
        global.TransactionForm?.handleAmountInput?.(e);
      });

      // Confirm delete button
      document.getElementById('btn-confirm-delete-tx')?.addEventListener('click', () => this.handleConfirmDelete());

      // Global events
      window.addEventListener('transactionadded', (e) => {
        const newTx = e?.detail?.transaction;
        if (newTx && newTx.date) {
          const { startDate, endDate, preset } = this.currentFilters;
          if (preset !== 'all' && ((startDate && newTx.date < startDate) || (endDate && newTx.date > endDate))) {
            this.applyDatePreset('all');
            const presetSelect = document.getElementById('filter-date-preset');
            if (presetSelect) presetSelect.value = 'all';
          }
        }
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      });
      window.addEventListener('transactionupdated', () => this.render());
      window.addEventListener('transactiondeleted', () => this.render());
      window.addEventListener('transactionschanged', () => this.render());
      window.addEventListener('categorieschanged', () => { this.populateCategories(); this.render(); });
    }

    init() {
      this.initEventListeners();
      this.render();
    }
  }

  /* ------------------------------------------------------------------
     Exports
     ------------------------------------------------------------------ */
  const manager = new HistoryManager();

  global.HistoryManager = manager;
  global.HistoryUI = manager;
  global.History = manager;

  if (typeof globalThis !== 'undefined') {
    globalThis.HistoryManager = manager;
    globalThis.HistoryUI = manager;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = manager;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
