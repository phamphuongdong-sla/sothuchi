/**
 * js/history.js - Transaction History & Filter/Search Manager
 * Handles transaction history listing, date/month grouping, keyword search (300ms debounce),
 * category filtering, date range filtering presets, pagination/infinite scroll,
 * and inline edit/delete transaction modals.
 */

(function(global) {
  'use strict';

  class HistoryManager {
    constructor() {
      this.currentFilters = {
        query: '',
        category: 'all',
        type: 'all',
        startDate: '',
        endDate: '',
        preset: 'this_month'
      };
      this.pagination = {
        currentPage: 1,
        pageSize: 20,
        visibleCount: 20,
        hasMore: false
      };
      this.activeEditId = null;
      this.activeDeleteId = null;
      this.debounceTimer = null;
      this.isInitialized = false;
    }

    /**
     * Escape HTML special characters for XSS prevention
     * @param {string} str 
     * @returns {string} Safe string
     */
    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * Filter transactions based on filter parameters
     * @param {Object} filters - { query, category, type, startDate, endDate, transactions }
     * @returns {Array} Filtered list of transactions
     */
    filterTransactions(filters = {}) {
      const db = global.DB || (global.window && global.window.DB) || (typeof window !== 'undefined' && window.DB);
      let txs = filters.transactions || (db && typeof db.getTransactions === 'function' ? db.getTransactions() : []);

      // Exclude soft-deleted records from active history view
      txs = txs.filter(t => t.sync_status !== 'pending_delete');

      const query = (filters.query !== undefined ? filters.query : (this.currentFilters.query || '')).trim().toLowerCase();
      const category = filters.category !== undefined ? filters.category : (this.currentFilters.category || 'all');
      const type = filters.type !== undefined ? filters.type : (this.currentFilters.type || 'all');
      const startDate = filters.startDate !== undefined ? filters.startDate : (this.currentFilters.startDate || '');
      const endDate = filters.endDate !== undefined ? filters.endDate : (this.currentFilters.endDate || '');

      // Inverted Date Range check: if startDate > endDate, return empty array
      if (startDate && endDate && startDate > endDate) {
        return [];
      }

      return txs.filter(tx => {
        // Date range filter
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;

        // Type filter
        if (type && type !== 'all' && tx.type !== type) return false;

        // Category filter (matches subcategory name or main group name)
        if (category && category !== 'all') {
          const matchesCat = tx.category === category;
          const catObj = global.Categories && typeof global.Categories.getAll === 'function'
            ? global.Categories.getAll().find(c => c.name === tx.category)
            : null;
          const matchesGroup = catObj && (catObj.group === category || catObj.groupId === category);
          if (!matchesCat && !matchesGroup) return false;
        }

        // Keyword Search filter (matches note, category, group, amount, or date)
        if (query) {
          const noteText = (tx.note || '').toLowerCase();
          const categoryText = (tx.category || '').toLowerCase();
          const catObj = global.Categories && typeof global.Categories.getAll === 'function'
            ? global.Categories.getAll().find(c => c.name === tx.category)
            : null;
          const groupText = catObj ? (catObj.group || '').toLowerCase() : '';
          const amountText = String(tx.amount || '');
          const dateText = (tx.date || '').toLowerCase();
          const matchesQuery = noteText.includes(query) || categoryText.includes(query) || groupText.includes(query) || amountText.includes(query) || dateText.includes(query);
          if (!matchesQuery) return false;
        }

        return true;
      });
    }

    /**
     * Group transactions by date string YYYY-MM-DD
     * @param {Array} transactions 
     * @returns {Array} Array of groups: [{ date, transactions, totalIncome, totalExpense, netTotal }]
     */
    groupTransactionsByDate(transactions = []) {
      const groupMap = {};

      transactions.forEach(tx => {
        const dateKey = tx.date || 'Khác';
        if (!groupMap[dateKey]) {
          groupMap[dateKey] = {
            date: dateKey,
            transactions: [],
            totalIncome: 0,
            totalExpense: 0,
            netTotal: 0
          };
        }

        groupMap[dateKey].transactions.push(tx);
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          groupMap[dateKey].totalIncome += amount;
        } else {
          groupMap[dateKey].totalExpense += amount;
        }
        groupMap[dateKey].netTotal = groupMap[dateKey].totalIncome - groupMap[dateKey].totalExpense;
      });

      // Sort dates descending
      const sortedDates = Object.keys(groupMap).sort((a, b) => b.localeCompare(a));
      return sortedDates.map(dateKey => groupMap[dateKey]);
    }

    /**
     * Populate Category Dropdown Filter
     */
    populateCategories() {
      if (typeof document === 'undefined') return;
      const selectEl = document.getElementById('filter-category');
      if (!selectEl) return;

      const db = global.DB || (global.window && global.window.DB);
      let categories = [];
      if (db && typeof db.getCategories === 'function') {
        categories = db.getCategories(true);
      } else if (global.Categories && typeof global.Categories.getCategories === 'function') {
        categories = global.Categories.getCategories(true);
      }

      const currentVal = this.currentFilters.category || 'all';
      selectEl.innerHTML = '<option value="all">Tất cả hạng mục</option>';

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
          opt.textContent = `${cat.icon ? cat.icon + ' ' : ''}${cat.name}${cat.isHidden ? ' (Đã ẩn)' : ''}`;
          optgroup.appendChild(opt);
        });
        selectEl.appendChild(optgroup);
      });

      selectEl.value = currentVal;
    }

    /**
     * Apply Preset Date Range
     * @param {string} presetKey - 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom'
     */
    applyDatePreset(presetKey) {
      this.currentFilters.preset = presetKey;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      let startDate = '';
      let endDate = '';

      if (presetKey === 'this_month') {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      } else if (presetKey === 'last_month') {
        const firstDay = new Date(currentYear, currentMonth - 1, 1);
        const lastDay = new Date(currentYear, currentMonth, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      } else if (presetKey === 'this_year') {
        startDate = `${currentYear}-01-01`;
        endDate = `${currentYear}-12-31`;
      } else if (presetKey === 'all') {
        startDate = '';
        endDate = '';
      }

      if (presetKey !== 'custom') {
        this.currentFilters.startDate = startDate;
        this.currentFilters.endDate = endDate;

        if (typeof document !== 'undefined') {
          const startEl = document.getElementById('filter-start-date');
          const endEl = document.getElementById('filter-end-date');
          if (startEl) startEl.value = startDate;
          if (endEl) endEl.value = endDate;
        }
      }
    }

    /**
     * Render transaction history list in DOM with pagination batching
     * @param {Array} transactions 
     * @param {HTMLElement} container 
     */
    renderHistoryList(transactions, container) {
      if (typeof document === 'undefined') return;
      container = container || document.getElementById('history-list-container');
      if (!container) return;

      const loadMoreBtn = document.getElementById('btn-load-more');
      const loadMoreCount = document.getElementById('load-more-count');

      if (!transactions || transactions.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>Không tìm thấy giao dịch nào</p>
          </div>
        `;
        if (loadMoreBtn) loadMoreBtn.hidden = true;
        return;
      }

      // Pagination batching logic
      const totalCount = transactions.length;
      const visibleBatch = transactions.slice(0, this.pagination.visibleCount);
      const remainingCount = totalCount - visibleBatch.length;

      if (loadMoreBtn) {
        if (remainingCount > 0) {
          loadMoreBtn.hidden = false;
          if (loadMoreCount) loadMoreCount.textContent = `(Còn ${remainingCount} giao dịch)`;
        } else {
          loadMoreBtn.hidden = true;
        }
      }

      const groups = this.groupTransactionsByDate(visibleBatch);
      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      let html = '';
      groups.forEach(group => {
        html += `
          <div class="history-group">
            <div class="history-group-header">
              <span class="group-date">${this.escapeHTML(group.date)}</span>
              <span class="group-totals">
                ${group.totalIncome > 0 ? `<span class="income-badge">+${formatVND(group.totalIncome)}</span>` : ''}
                ${group.totalExpense > 0 ? `<span class="expense-badge">-${formatVND(group.totalExpense)}</span>` : ''}
              </span>
            </div>
            <div class="history-group-items">
        `;

        group.transactions.forEach(tx => {
          const isIncome = tx.type === 'income';
          html += `
            <div class="history-item ${isIncome ? 'income' : 'expense'}" data-id="${tx.id}">
              <div class="item-icon">${isIncome ? '📈' : '📉'}</div>
              <div class="item-details">
                <div class="item-category">${this.escapeHTML(tx.category || 'Khác')}</div>
                <div class="item-note">${this.escapeHTML(tx.note || '')}</div>
              </div>
              <div class="item-amount ${isIncome ? 'income-text' : 'expense-text'}">
                ${isIncome ? '+' : '-'}${formatVND(tx.amount)}
              </div>
              <div class="item-actions">
                <button type="button" class="btn-icon edit-tx" data-id="${tx.id}" title="Sửa">✏️</button>
                <button type="button" class="btn-icon delete-tx" data-id="${tx.id}" title="Xóa">🗑️</button>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    /**
     * Open Edit Transaction Modal
     * @param {string} id 
     */
    openEditModal(id) {
      if (typeof document === 'undefined') return;
      const db = global.DB || (global.window && global.window.DB);
      if (!db || typeof db.getTransactions !== 'function') return;

      const txs = db.getTransactions({ includeDeleted: false });
      const tx = txs.find(t => t.id === id);
      if (!tx) return;

      this.activeEditId = id;
      const modal = document.getElementById('modal-edit-tx');
      if (!modal) return;

      const idInput = document.getElementById('edit-tx-id');
      const amountInput = document.getElementById('edit-tx-amount');
      const categorySelect = document.getElementById('edit-tx-category');
      const dateInput = document.getElementById('edit-tx-date');
      const noteInput = document.getElementById('edit-tx-note');
      const expenseRadio = document.getElementById('edit-type-expense');
      const incomeRadio = document.getElementById('edit-type-income');

      if (idInput) idInput.value = tx.id;
      if (tx.type === 'income') {
        if (incomeRadio) incomeRadio.checked = true;
      } else {
        if (expenseRadio) expenseRadio.checked = true;
      }

      const formatVNDInput = global.formatVNDInput || (v => v ? Number(v).toLocaleString('vi-VN') : '');
      if (amountInput) amountInput.value = formatVNDInput(tx.amount);
      if (dateInput) dateInput.value = tx.date;
      if (noteInput) noteInput.value = tx.note || '';

      // Populate categories for edit modal
      this.populateEditCategories(tx.type, tx.category);

      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Populate edit modal category options
     * @param {string} type 
     * @param {string} selectedCat 
     */
    populateEditCategories(type, selectedCat) {
      if (typeof document === 'undefined') return;
      const selectEl = document.getElementById('edit-tx-category');
      if (!selectEl) return;

      let categories = [];
      if (global.Categories && typeof global.Categories.getActive === 'function') {
        categories = global.Categories.getActive(type);
      } else {
        const db = global.DB || (global.window && global.window.DB);
        if (db && typeof db.getCategories === 'function') {
          categories = db.getCategories(true).filter(c => !c.isHidden && c.type === type);
        }
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

      // If existing category is hidden or custom, ensure option exists
      if (selectedCat && !categories.some(c => c.name === selectedCat)) {
        const customOpt = document.createElement('option');
        customOpt.value = selectedCat;
        customOpt.textContent = selectedCat;
        selectEl.appendChild(customOpt);
      }

      if (selectedCat) selectEl.value = selectedCat;
    }

    /**
     * Close Edit Transaction Modal
     */
    closeEditModal() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-edit-tx');
      if (modal) {
        modal.setAttribute('hidden', '');
        modal.setAttribute('aria-hidden', 'true');
      }
      this.activeEditId = null;
    }

    /**
     * Handle Edit Modal Form Submission
     * @param {Event} e 
     */
    handleSaveEdit(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof document === 'undefined') return;

      const idInput = document.getElementById('edit-tx-id');
      const id = idInput ? idInput.value : this.activeEditId;
      if (!id) return;

      const typeRadio = document.querySelector('input[name="edit-tx-type"]:checked');
      const type = typeRadio ? typeRadio.value : 'expense';

      const amountInput = document.getElementById('edit-tx-amount');
      const parseRawAmount = global.parseRawAmount || (str => str ? parseInt(String(str).replace(/\D/g, ''), 10) : 0);
      const amount = parseRawAmount(amountInput ? amountInput.value : '');

      const categorySelect = document.getElementById('edit-tx-category');
      const category = categorySelect ? categorySelect.value : '';

      const dateInput = document.getElementById('edit-tx-date');
      const date = dateInput ? dateInput.value : '';

      const noteInput = document.getElementById('edit-tx-note');
      const note = noteInput ? noteInput.value.trim() : '';

      if (!amount || isNaN(amount) || amount <= 0) {
        if (global.Toast) global.Toast.show('Số tiền phải lớn hơn 0', 'error');
        return;
      }

      if (!category) {
        if (global.Toast) global.Toast.show('Vui lòng chọn hạng mục', 'warning');
        return;
      }

      const db = global.DB || (global.window && global.window.DB);
      if (db && typeof db.updateTransaction === 'function') {
        const updatedTx = db.updateTransaction(id, { type, amount, category, date, note });
        this.closeEditModal();

        if (global.Toast) global.Toast.show('Đã cập nhật giao dịch thành công!', 'success');

        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('transactionupdated', { detail: updatedTx }));
        }

        this.render();
      }
    }

    /**
     * Open Delete Confirmation Modal
     * @param {string} id 
     */
    openDeleteModal(id) {
      if (typeof document === 'undefined') return;
      const db = global.DB || (global.window && global.window.DB);
      if (!db || typeof db.getTransactions !== 'function') return;

      const txs = db.getTransactions({ includeDeleted: false });
      const tx = txs.find(t => t.id === id);
      if (!tx) return;

      this.activeDeleteId = id;
      const modal = document.getElementById('modal-delete-tx');
      const summaryEl = document.getElementById('delete-tx-summary');
      if (!modal) return;

      const formatVND = (db && db.formatVND) || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      if (summaryEl) {
        summaryEl.innerHTML = `
          <div><strong>Loại:</strong> ${tx.type === 'income' ? '💰 Thu nhập' : '💸 Chi tiêu'}</div>
          <div><strong>Hạng mục:</strong> ${this.escapeHTML(tx.category)}</div>
          <div><strong>Số tiền:</strong> ${formatVND(tx.amount)}</div>
          <div><strong>Ngày:</strong> ${this.escapeHTML(tx.date)}</div>
          ${tx.note ? `<div><strong>Ghi chú:</strong> ${this.escapeHTML(tx.note)}</div>` : ''}
        `;
      }

      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Close Delete Confirmation Modal
     */
    closeDeleteModal() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-delete-tx');
      if (modal) {
        modal.setAttribute('hidden', '');
        modal.setAttribute('aria-hidden', 'true');
      }
      this.activeDeleteId = null;
    }

    /**
     * Handle Delete Confirmation
     */
    handleConfirmDelete() {
      if (!this.activeDeleteId) return;
      const id = this.activeDeleteId;

      const db = global.DB || (global.window && global.window.DB);
      if (db && typeof db.deleteTransaction === 'function') {
        db.deleteTransaction(id);
        this.closeDeleteModal();

        if (global.Toast) global.Toast.show('Đã xóa giao dịch!', 'info');

        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('transactiondeleted', { detail: { id } }));
        }

        this.render();
      }
    }

    /**
     * Primary Render View Entrypoint
     */
    render() {
      if (typeof document === 'undefined') return;
      this.populateCategories();
      const filteredTxs = this.filterTransactions();
      const container = document.getElementById('history-list-container');
      this.renderHistoryList(filteredTxs, container);
    }

    /**
     * Bind UI & Event Listeners
     */
    initEventListeners() {
      if (this.isInitialized || typeof document === 'undefined') return;
      this.isInitialized = true;

      // 1. Search Query Input (300ms Debounce)
      const searchInput = document.getElementById('search-query');
      const clearSearchBtn = document.getElementById('btn-clear-search');

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const val = e.target.value;
          if (clearSearchBtn) clearSearchBtn.hidden = !val;

          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.currentFilters.query = val;
            this.pagination.visibleCount = this.pagination.pageSize;
            this.render();
          }, 300);
        });
      }

      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          clearSearchBtn.hidden = true;
          this.currentFilters.query = '';
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        });
      }

      // 2. Type Filter Select
      const typeSelect = document.getElementById('filter-type');
      if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
          this.currentFilters.type = e.target.value;
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        });
      }

      // 3. Category Filter Select
      const categorySelect = document.getElementById('filter-category');
      if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
          this.currentFilters.category = e.target.value;
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        });
      }

      // 4. Date Preset Range Select
      const presetSelect = document.getElementById('filter-date-preset');
      if (presetSelect) {
        // Set initial preset
        this.applyDatePreset(presetSelect.value || 'this_month');

        presetSelect.addEventListener('change', (e) => {
          this.applyDatePreset(e.target.value);
          this.pagination.visibleCount = this.pagination.pageSize;
          this.render();
        });
      }

      // 5. Start and End Date Inputs
      const startDateInput = document.getElementById('filter-start-date');
      const endDateInput = document.getElementById('filter-end-date');

      const handleCustomDateChange = () => {
        if (presetSelect) presetSelect.value = 'custom';
        this.currentFilters.preset = 'custom';
        this.currentFilters.startDate = startDateInput ? startDateInput.value : '';
        this.currentFilters.endDate = endDateInput ? endDateInput.value : '';
        this.pagination.visibleCount = this.pagination.pageSize;
        this.render();
      };

      if (startDateInput) startDateInput.addEventListener('change', handleCustomDateChange);
      if (endDateInput) endDateInput.addEventListener('change', handleCustomDateChange);

      // 6. Load More Button (Pagination)
      const loadMoreBtn = document.getElementById('btn-load-more');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          this.pagination.visibleCount += this.pagination.pageSize;
          this.render();
        });
      }

      // 7. Event Delegation for Edit & Delete icons in History List
      const historyContainer = document.getElementById('history-list-container');
      if (historyContainer) {
        historyContainer.addEventListener('click', (e) => {
          const editBtn = e.target.closest('.edit-tx');
          if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            if (id) this.openEditModal(id);
            return;
          }

          const deleteBtn = e.target.closest('.delete-tx');
          if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            if (id) this.openDeleteModal(id);
            return;
          }
        });
      }

      // 8. Close Modal Controls
      document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-modal]');
        if (closeBtn) {
          const modalType = closeBtn.getAttribute('data-close-modal');
          if (modalType === 'edit-tx') this.closeEditModal();
          if (modalType === 'delete-tx') this.closeDeleteModal();
          return;
        }

        // Backdrop click to close
        if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
          if (e.target.id === 'modal-edit-tx') this.closeEditModal();
          if (e.target.id === 'modal-delete-tx') this.closeDeleteModal();
        }
      });

      // 9. Edit Form Submission & Type Switcher Listener
      const editForm = document.getElementById('form-edit-tx');
      if (editForm) {
        editForm.addEventListener('submit', (e) => this.handleSaveEdit(e));
      }

      const editTypeRadios = document.querySelectorAll('input[name="edit-tx-type"]');
      editTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.populateEditCategories(e.target.value);
        });
      });

      const editAmountInput = document.getElementById('edit-tx-amount');
      if (editAmountInput) {
        editAmountInput.addEventListener('input', (e) => {
          if (global.TransactionForm && typeof global.TransactionForm.handleAmountInput === 'function') {
            global.TransactionForm.handleAmountInput(e);
          }
        });
      }

      // 10. Confirm Delete Button Listener
      const confirmDeleteBtn = document.getElementById('btn-confirm-delete-tx');
      if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => this.handleConfirmDelete());
      }

      // 11. Global Custom Window Event Listeners
      if (typeof window !== 'undefined') {
        window.addEventListener('transactionadded', () => this.render());
        window.addEventListener('transactionupdated', () => this.render());
        window.addEventListener('transactiondeleted', () => this.render());
        window.addEventListener('transactionschanged', () => this.render());
        window.addEventListener('categorieschanged', () => {
          this.populateCategories();
          this.render();
        });
      }
    }

    /**
     * Initialization method
     */
    init() {
      this.initEventListeners();
      this.render();
    }
  }

  const manager = new HistoryManager();
  global.HistoryManager = manager;
  global.History = manager;
  global.HistoryUI = manager;
  if (typeof window !== 'undefined') {
    window.HistoryManager = manager;
    window.History = manager;
    window.HistoryUI = manager;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.HistoryManager = manager;
    globalThis.History = manager;
    globalThis.HistoryUI = manager;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = manager;
  }
})(typeof window !== 'undefined' ? window : this);
