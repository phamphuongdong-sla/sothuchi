/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Core Data Model & LocalStorage Manager (js/db.js)
   ========================================================================== */

(function (global) {
  'use strict';

  const KEYS = {
    TX: 'stc_transactions',
    TX_ALT: 'so_thu_chi_transactions',
    CAT: 'stc_categories',
    CAT_ALT: 'so_thu_chi_categories'
  };

  function generateId(prefix) {
    prefix = prefix || 'tx';
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function normalizeTransaction(tx) {
    if (!tx || typeof tx !== 'object') return null;
    const now = new Date().toISOString();
    const created = tx.created_at || tx.createdAt || now;
    const updated = tx.updated_at || tx.updatedAt || created;

    const typeVal = tx.type === 'income' ? 'income' : 'expense';
    const amountVal = Number(tx.amount);
    const categoryVal = String(
      tx.category !== undefined && tx.category !== null && tx.category !== ''
        ? tx.category
        : (typeVal === 'income' ? 'Lương' : 'Ăn uống')
    ).trim();
    const noteVal = tx.note !== undefined && tx.note !== null ? String(tx.note) : '';
    const dateVal = tx.date ? String(tx.date) : now.split('T')[0];
    const syncStatusVal = tx.sync_status || 'pending_add';
    const idVal = String(tx.id || generateId('tx'));

    return {
      id: idVal,
      date: dateVal,
      type: typeVal,
      category: categoryVal,
      amount: isNaN(amountVal) ? 0 : amountVal,
      note: noteVal,
      created_at: created,
      createdAt: created,
      updated_at: updated,
      updatedAt: updated,
      sync_status: syncStatusVal
    };
  }

  class DatabaseManager {
    constructor(customStorage) {
      this._customStorage = customStorage;
    }

    get storage() {
      if (this._customStorage) return this._customStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
      return null;
    }

    _getItem(key, altKey) {
      const s = this.storage;
      if (!s) return null;
      try {
        const val = s.getItem(key);
        if (val !== null && val !== undefined) return val;
        if (altKey) return s.getItem(altKey);
        return null;
      } catch (e) {
        return null;
      }
    }

    _setItem(key, value, altKey) {
      const s = this.storage;
      if (!s) return;
      try {
        s.setItem(key, value);
        if (altKey) s.setItem(altKey, value);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.message?.includes('QuotaExceededError'))) {
          throw new Error('Dung lượng lưu trữ trình duyệt đã đầy (LocalStorage Quota Exceeded)');
        }
        throw e;
      }
    }

    getTransactions(filter = {}) {
      const raw = this._getItem(KEYS.TX, KEYS.TX_ALT);
      if (!raw) return [];

      let list = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.map(normalizeTransaction).filter(Boolean);
        }
      } catch (e) {
        console.warn('[DB] Corrupted transactions JSON detected in LocalStorage, falling back to empty array.', e);
        return [];
      }

      // Filter out deleted items unless includeDeleted is explicitly true
      if (!filter.includeDeleted) {
        list = list.filter(t => t.sync_status !== 'pending_delete');
      }

      // Filter by type
      if (filter.type && filter.type !== 'all') {
        list = list.filter(t => t.type === filter.type);
      }

      // Filter by category
      if (filter.category && filter.category !== 'all') {
        list = list.filter(t => t.category === filter.category);
      }

      // Filter by startDate
      if (filter.startDate) {
        list = list.filter(t => t.date >= filter.startDate);
      }

      // Filter by endDate
      if (filter.endDate) {
        list = list.filter(t => t.date <= filter.endDate);
      }

      // Filter by keyword or query search string
      const searchKeyword = (filter.keyword || filter.query || '').trim().toLowerCase();
      if (searchKeyword) {
        list = list.filter(t => {
          const noteMatch = t.note && t.note.toLowerCase().includes(searchKeyword);
          const catMatch = t.category && t.category.toLowerCase().includes(searchKeyword);
          return noteMatch || catMatch;
        });
      }

      // Filter by sync_status
      if (filter.sync_status) {
        list = list.filter(t => t.sync_status === filter.sync_status);
      }

      // Sort by date desc, created_at desc
      list.sort((a, b) => {
        if (b.date !== a.date) {
          return b.date.localeCompare(a.date);
        }
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      return list;
    }

    _getAllStoredTransactionsRaw() {
      const raw = this._getItem(KEYS.TX, KEYS.TX_ALT);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeTransaction).filter(Boolean) : [];
      } catch (e) {
        return [];
      }
    }

    saveTransactions(txs) {
      const normalized = (txs || []).map(normalizeTransaction).filter(Boolean);
      this._setItem(KEYS.TX, JSON.stringify(normalized), KEYS.TX_ALT);

      // Auto-trigger SyncEngine pushSync immediately after saving local DB
      if (typeof window !== 'undefined') {
        const syncInst = window.SyncEngine || window.SyncManager;
        if (syncInst && typeof syncInst.pushSync === 'function') {
          setTimeout(() => {
            try {
              syncInst.pushSync().catch(() => {});
            } catch (e) {}
          }, 100);
        }
      }
    }

    addTransaction(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Dữ liệu giao dịch không hợp lệ');
      }

      const amountNum = Number(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Số tiền phải là số dương hợp lệ');
      }

      const allTxs = this._getAllStoredTransactionsRaw();
      const now = new Date().toISOString();
      const created = data.created_at || data.createdAt || now;
      const updated = data.updated_at || data.updatedAt || now;

      const newTx = normalizeTransaction({
        id: data.id || generateId('tx'),
        date: data.date || now.split('T')[0],
        type: data.type === 'income' ? 'income' : 'expense',
        category: data.category || (data.type === 'income' ? 'Lương' : 'Ăn uống'),
        amount: amountNum,
        note: data.note || '',
        created_at: created,
        createdAt: created,
        updated_at: updated,
        updatedAt: updated,
        sync_status: data.sync_status || 'pending_add'
      });

      allTxs.push(newTx);
      this.saveTransactions(allTxs);
      return newTx;
    }

    updateTransaction(id, data) {
      if (!id) {
        throw new Error('Không tìm thấy giao dịch');
      }

      const allTxs = this._getAllStoredTransactionsRaw();
      const idx = allTxs.findIndex(t => t.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy giao dịch');
      }

      const current = allTxs[idx];

      let amountNum = current.amount;
      if (data.amount !== undefined) {
        amountNum = Number(data.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error('Số tiền phải là số dương hợp lệ');
        }
      }

      const now = new Date().toISOString();
      let nextSyncStatus = data.sync_status || current.sync_status;
      if (!data.sync_status && current.sync_status === 'synced') {
        nextSyncStatus = 'pending_update';
      }

      const updatedTx = normalizeTransaction({
        ...current,
        ...data,
        amount: amountNum,
        updated_at: now,
        updatedAt: now,
        sync_status: nextSyncStatus
      });

      allTxs[idx] = updatedTx;
      this.saveTransactions(allTxs);
      return updatedTx;
    }

    deleteTransaction(id) {
      if (!id) return false;

      const allTxs = this._getAllStoredTransactionsRaw();
      const idx = allTxs.findIndex(t => t.id === id);
      if (idx === -1) return false;

      const target = allTxs[idx];
      if (target.sync_status === 'synced' || target.sync_status === 'pending_update') {
        target.sync_status = 'pending_delete';
        target.updated_at = new Date().toISOString();
        target.updatedAt = target.updated_at;
        allTxs[idx] = normalizeTransaction(target);
      } else {
        allTxs.splice(idx, 1);
      }

      this.saveTransactions(allTxs);
      return true;
    }

    getCategories(includeHidden) {
      if (global.Categories && typeof global.Categories.getCategories === 'function') {
        return global.Categories.getCategories(includeHidden !== false);
      }
      if (global.CategoryManager && typeof global.CategoryManager.getCategories === 'function') {
        return global.CategoryManager.getCategories(includeHidden !== false);
      }

      const raw = this._getItem(KEYS.CAT, KEYS.CAT_ALT);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return includeHidden ? parsed : parsed.filter(c => !c.is_hidden && !c.isHidden);
      } catch (e) {
        return [];
      }
    }

    saveCategories(cats) {
      if (global.Categories && typeof global.Categories.saveToStorage === 'function') {
        return global.Categories.saveToStorage(cats);
      }
      const json = JSON.stringify(cats || []);
      this._setItem(KEYS.CAT, json, KEYS.CAT_ALT);
    }

    formatVND(amount) {
      const num = Math.round(Number(amount) || 0);
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
    }
  }

  const dbInstance = new DatabaseManager();

  // Attach formatting utility
  function formatVND(amount) {
    return dbInstance.formatVND(amount);
  }

  global.DatabaseManager = DatabaseManager;
  global.DB = dbInstance;
  global.db = dbInstance;
  global.formatVND = formatVND;

  if (typeof window !== 'undefined') {
    window.DatabaseManager = DatabaseManager;
    window.DB = dbInstance;
    window.db = dbInstance;
    window.formatVND = formatVND;
  }
  if (typeof global !== 'undefined') {
    global.DatabaseManager = DatabaseManager;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DatabaseManager = DatabaseManager;
    globalThis.DB = dbInstance;
    globalThis.db = dbInstance;
    globalThis.formatVND = formatVND;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
  }
})(typeof window !== 'undefined' ? window : this);

