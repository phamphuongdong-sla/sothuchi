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
    return (prefix || 'tx') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function formatLocalYMD(d) {
    if (!d) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    if (typeof d === 'string') {
      const cleaned = d.trim();
      if (cleaned.includes('T')) return cleaned.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
      d = new Date(cleaned);
    }
    if (d instanceof Date && !isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function normalizeTransaction(tx) {
    if (!tx || typeof tx !== 'object') return null;
    const now = new Date().toISOString();
    const created = tx.created_at || tx.createdAt || now;
    const updated = tx.updated_at || tx.updatedAt || created;
    const type = tx.type === 'income' ? 'income' : 'expense';
    const amount = Number(tx.amount);
    const category = String(
      tx.category != null && tx.category !== ''
        ? tx.category
        : (type === 'income' ? 'Lương' : 'Ăn uống')
    ).trim();

    return {
      id: String(tx.id || generateId('tx')),
      date: formatLocalYMD(tx.date),
      type,
      category,
      amount: isNaN(amount) ? 0 : amount,
      note: tx.note != null ? String(tx.note) : '',
      created_at: created,
      updated_at: updated,
      sync_status: tx.sync_status || 'pending_add'
    };
  }

  class DatabaseManager {
    constructor(customStorage) {
      this._storage = customStorage || null;
    }

    get storage() {
      return this._storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    }

    _getItem(key, altKey) {
      const s = this.storage;
      if (!s) return null;
      try {
        return s.getItem(key) ?? (altKey ? s.getItem(altKey) : null);
      } catch (_) { return null; }
    }

    _setItem(key, value, altKey) {
      const s = this.storage;
      if (!s) return;
      try {
        s.setItem(key, value);
        if (altKey) s.setItem(altKey, value);
      } catch (e) {
        if (e?.name === 'QuotaExceededError' || e?.code === 22) {
          throw new Error('QuotaExceededError: Dung lượng lưu trữ trình duyệt đã đầy');
        }
        throw e;
      }
    }

    _loadAll() {
      const raw = this._getItem(KEYS.TX, KEYS.TX_ALT);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeTransaction).filter(Boolean) : [];
      } catch (e) {
        console.warn('[DB] Corrupted transactions JSON, falling back to empty array.', e);
        return [];
      }
    }

    getTransactions(filter = {}) {
      let list = this._loadAll();

      if (!filter.includeDeleted) {
        list = list.filter(t => t.sync_status !== 'pending_delete');
      }
      if (filter.type && filter.type !== 'all') {
        list = list.filter(t => t.type === filter.type);
      }
      if (filter.category && filter.category !== 'all') {
        list = list.filter(t => t.category === filter.category);
      }
      if (filter.startDate) {
        list = list.filter(t => t.date >= filter.startDate);
      }
      if (filter.endDate) {
        list = list.filter(t => t.date <= filter.endDate);
      }
      if (filter.sync_status) {
        list = list.filter(t => t.sync_status === filter.sync_status);
      }

      const keyword = (filter.keyword || filter.query || '').trim().toLowerCase();
      if (keyword) {
        list = list.filter(t =>
          t.note?.toLowerCase().includes(keyword) ||
          t.category?.toLowerCase().includes(keyword)
        );
      }

      list.sort((a, b) =>
        b.date !== a.date
          ? b.date.localeCompare(a.date)
          : (b.created_at || '').localeCompare(a.created_at || '')
      );

      return list;
    }

    saveTransactions(txs, options = {}) {
      const normalized = (txs || []).map(normalizeTransaction).filter(Boolean);
      this._setItem(KEYS.TX, JSON.stringify(normalized), KEYS.TX_ALT);

      if (!options.skipAutoPush && typeof window !== 'undefined' && !window.__isTestEnv &&
          window.location?.protocol?.startsWith('http')) {
        const sync = window.SyncEngine;
        if (sync?.pushSync) {
          setTimeout(() => sync.pushSync().catch(() => {}), 50);
        }
      }
    }

    addTransaction(data) {
      if (!data || typeof data !== 'object') throw new Error('Dữ liệu giao dịch không hợp lệ');
      const amount = Number(data.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Số tiền phải là số dương hợp lệ');

      const now = new Date().toISOString();
      const newTx = normalizeTransaction({
        id: data.id || generateId('tx'),
        date: data.date || now.split('T')[0],
        type: data.type === 'income' ? 'income' : 'expense',
        category: data.category || (data.type === 'income' ? 'Lương' : 'Ăn uống'),
        amount,
        note: data.note || '',
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        sync_status: data.sync_status || 'pending_add'
      });

      const all = this._loadAll();
      all.push(newTx);
      this.saveTransactions(all);
      return newTx;
    }

    updateTransaction(id, data) {
      if (!id) throw new Error('Không tìm thấy giao dịch');
      const all = this._loadAll();
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Không tìm thấy giao dịch');

      const current = all[idx];
      let amount = current.amount;
      if (data.amount !== undefined) {
        amount = Number(data.amount);
        if (isNaN(amount) || amount <= 0) throw new Error('Số tiền phải là số dương hợp lệ');
      }

      const now = new Date().toISOString();
      const syncStatus = data.sync_status ||
        (current.sync_status === 'synced' ? 'pending_update' : current.sync_status);

      all[idx] = normalizeTransaction({
        ...current, ...data,
        amount,
        updated_at: now,
        sync_status: syncStatus
      });

      this.saveTransactions(all);
      return all[idx];
    }

    deleteTransaction(id) {
      if (!id) return false;
      const all = this._loadAll();
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) return false;

      const target = all[idx];
      if (target.sync_status === 'synced' || target.sync_status === 'pending_update') {
        const now = new Date().toISOString();
        all[idx] = normalizeTransaction({ ...target, sync_status: 'pending_delete', updated_at: now });
      } else {
        all.splice(idx, 1);
      }

      this.saveTransactions(all);
      return true;
    }

    getCategories(includeHidden) {
      const catMgr = global.Categories || global.CategoryManager;
      if (catMgr?.getCategories) return catMgr.getCategories(includeHidden !== false);

      const raw = this._getItem(KEYS.CAT, KEYS.CAT_ALT);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return includeHidden ? parsed : parsed.filter(c => !c.is_hidden && !c.isHidden);
      } catch (_) { return []; }
    }

    saveCategories(cats) {
      const catMgr = global.Categories || global.CategoryManager;
      if (catMgr?.saveToStorage) return catMgr.saveToStorage(cats);
      this._setItem(KEYS.CAT, JSON.stringify(cats || []), KEYS.CAT_ALT);
    }

    formatVND(amount) {
      return Math.round(Number(amount) || 0)
        .toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
    }
  }

  const dbInstance = new DatabaseManager();

  function formatVND(amount) { return dbInstance.formatVND(amount); }

  // Exports
  global.DatabaseManager = DatabaseManager;
  global.DB = dbInstance;
  global.db = dbInstance;
  global.formatVND = formatVND;
  global.formatLocalYMD = formatLocalYMD;

  if (typeof globalThis !== 'undefined') {
    globalThis.DatabaseManager = DatabaseManager;
    globalThis.DB = dbInstance;
    globalThis.db = dbInstance;
    globalThis.formatVND = formatVND;
    globalThis.formatLocalYMD = formatLocalYMD;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
  }
})(typeof window !== 'undefined' ? window : this);
