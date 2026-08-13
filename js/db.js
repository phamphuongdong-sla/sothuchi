/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Core Data Model & LocalStorage Manager (js/db.js)
   ========================================================================== */

(function (global) {
  'use strict';

  const KEYS = {
    TX: 'stc_transactions',
    TX_ALT: 'so_thu_chi_transactions',
    CAT: 'stc_categories',
    CAT_ALT: 'so_thu_chi_categories',
    ASSET: 'stc_assets',
    LIABILITY: 'stc_liabilities',
    LOAN: 'stc_loans',
    RECURRING: 'stc_recurring',
    AUDIT: 'stc_audit_logs'
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
      this.logAuditEvent('add', 'transaction', newTx.id, null, newTx);
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
      this.logAuditEvent('update', 'transaction', id, current, all[idx]);
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
      this.logAuditEvent('delete', 'transaction', id, target, null);
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

    // Audit Log Trail
    getAuditLogs() {
      const raw = this._getItem(KEYS.AUDIT);
      if (!raw) return [];
      try { return JSON.parse(raw) || []; } catch (_) { return []; }
    }

    logAuditEvent(action, entityType, entityId, oldData = null, newData = null) {
      const logs = this.getAuditLogs();
      logs.unshift({
        id: generateId('audit'),
        timestamp: new Date().toISOString(),
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
        new_data: newData ? JSON.parse(JSON.stringify(newData)) : null
      });
      if (logs.length > 200) logs.length = 200;
      this._setItem(KEYS.AUDIT, JSON.stringify(logs));
    }

    revertAuditEvent(logId) {
      const logs = this.getAuditLogs();
      const entry = logs.find(l => l.id === logId);
      if (!entry) throw new Error('Không tìm thấy lịch sử vết sửa');

      if (entry.entity_type === 'transaction') {
        const all = this._loadAll();
        if (entry.action === 'add') {
          const idx = all.findIndex(t => t.id === entry.entity_id);
          if (idx !== -1) {
            all.splice(idx, 1);
            this.saveTransactions(all);
          }
        } else if (entry.action === 'update' || entry.action === 'delete') {
          if (entry.old_data) {
            const idx = all.findIndex(t => t.id === entry.entity_id);
            if (idx !== -1) {
              all[idx] = normalizeTransaction(entry.old_data);
            } else {
              all.push(normalizeTransaction(entry.old_data));
            }
            this.saveTransactions(all);
          }
        }
      }
      this.logAuditEvent('revert', entry.entity_type, entry.entity_id, entry.new_data, entry.old_data);
      return true;
    }

    // Assets & Liabilities (Net Worth Balance Sheet)
    getAssets() {
      const raw = this._getItem(KEYS.ASSET);
      if (!raw) return [];
      try { return JSON.parse(raw) || []; } catch (_) { return []; }
    }

    saveAsset(data) {
      const assets = this.getAssets();
      const id = data.id || generateId('asset');
      const now = new Date().toISOString();
      const newAsset = {
        id,
        name: String(data.name || 'Tài sản').trim(),
        category: data.category || 'Tài khoản ngân hàng',
        value: Math.max(0, Number(data.value) || 0),
        note: data.note || '',
        updated_at: now
      };
      const idx = assets.findIndex(a => a.id === id);
      if (idx !== -1) assets[idx] = newAsset;
      else assets.push(newAsset);
      this._setItem(KEYS.ASSET, JSON.stringify(assets));
      return newAsset;
    }

    deleteAsset(id) {
      const assets = this.getAssets().filter(a => a.id !== id);
      this._setItem(KEYS.ASSET, JSON.stringify(assets));
    }

    getLiabilities() {
      const raw = this._getItem(KEYS.LIABILITY);
      if (!raw) return [];
      try { return JSON.parse(raw) || []; } catch (_) { return []; }
    }

    saveLiability(data) {
      const liabilities = this.getLiabilities();
      const id = data.id || generateId('liab');
      const now = new Date().toISOString();
      const newLiab = {
        id,
        name: String(data.name || 'Khoản nợ').trim(),
        category: data.category || 'Thẻ tín dụng',
        total_debt: Math.max(0, Number(data.total_debt || data.value) || 0),
        remaining_debt: Math.max(0, Number(data.remaining_debt ?? data.value) || 0),
        note: data.note || '',
        updated_at: now
      };
      const idx = liabilities.findIndex(l => l.id === id);
      if (idx !== -1) liabilities[idx] = newLiab;
      else liabilities.push(newLiab);
      this._setItem(KEYS.LIABILITY, JSON.stringify(liabilities));
      return newLiab;
    }

    deleteLiability(id) {
      const liabilities = this.getLiabilities().filter(l => l.id !== id);
      this._setItem(KEYS.LIABILITY, JSON.stringify(liabilities));
    }

    calculateNetWorth() {
      const totalAssets = this.getAssets().reduce((sum, a) => sum + (Number(a.value) || 0), 0);
      const totalLiabilities = this.getLiabilities().reduce((sum, l) => sum + (Number(l.remaining_debt) || 0), 0);
      return {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities
      };
    }

    // Loans & Debts (Vay & Cho vay Tracker)
    getLoans() {
      const raw = this._getItem(KEYS.LOAN);
      if (!raw) return [];
      try { return JSON.parse(raw) || []; } catch (_) { return []; }
    }

    saveLoan(data) {
      const loans = this.getLoans();
      const id = data.id || generateId('loan');
      const now = new Date().toISOString();
      const newLoan = {
        id,
        type: data.type === 'loan' ? 'loan' : 'debt',
        person_name: String(data.person_name || 'Đối tác').trim(),
        original_amount: Math.max(0, Number(data.original_amount) || 0),
        remaining_amount: Math.max(0, Number(data.remaining_amount ?? data.original_amount) || 0),
        due_date: data.due_date || '',
        note: data.note || '',
        status: (Number(data.remaining_amount ?? data.original_amount) || 0) <= 0 ? 'paid' : 'active',
        repayments: data.repayments || [],
        updated_at: now
      };
      const idx = loans.findIndex(l => l.id === id);
      if (idx !== -1) loans[idx] = newLoan;
      else loans.push(newLoan);
      this._setItem(KEYS.LOAN, JSON.stringify(loans));
      return newLoan;
    }

    recordLoanRepayment(loanId, repaymentData) {
      const loans = this.getLoans();
      const idx = loans.findIndex(l => l.id === loanId);
      if (idx === -1) throw new Error('Không tìm thấy khoản vay');

      const target = loans[idx];
      const principal = Math.max(0, Number(repaymentData.principal) || 0);
      const interest = Math.max(0, Number(repaymentData.interest) || 0);
      const date = repaymentData.date || new Date().toISOString().split('T')[0];

      target.remaining_amount = Math.max(0, target.remaining_amount - principal);
      if (target.remaining_amount <= 0) target.status = 'paid';

      if (!target.repayments) target.repayments = [];
      target.repayments.push({
        id: generateId('pmt'),
        date,
        principal,
        interest,
        note: repaymentData.note || ''
      });
      target.updated_at = new Date().toISOString();

      this._setItem(KEYS.LOAN, JSON.stringify(loans));

      if (principal > 0 || interest > 0) {
        const isDebt = target.type === 'debt';
        const type = isDebt ? 'expense' : 'income';
        const cat = isDebt ? 'Trả nợ vay' : 'Thu hồi nợ';
        this.addTransaction({
          date,
          type,
          category: cat,
          amount: principal + interest,
          note: `Thanh toán cho ${target.person_name} (Gốc: ${this.formatVND(principal)}, Lãi: ${this.formatVND(interest)})`
        });
      }
      return target;
    }

    deleteLoan(id) {
      const loans = this.getLoans().filter(l => l.id !== id);
      this._setItem(KEYS.LOAN, JSON.stringify(loans));
    }

    // Recurring Automated Ledger
    getRecurring() {
      const raw = this._getItem(KEYS.RECURRING);
      if (!raw) return [];
      try { return JSON.parse(raw) || []; } catch (_) { return []; }
    }

    saveRecurring(data) {
      const list = this.getRecurring();
      const id = data.id || generateId('rec');
      const newItem = {
        id,
        type: data.type === 'income' ? 'income' : 'expense',
        amount: Math.max(0, Number(data.amount) || 0),
        category: data.category || 'Chi tiêu cố định',
        note: data.note || '',
        frequency: data.frequency || 'monthly',
        day_of_month: Number(data.day_of_month) || 1,
        last_run_date: data.last_run_date || '',
        is_active: data.is_active !== false
      };
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) list[idx] = newItem;
      else list.push(newItem);
      this._setItem(KEYS.RECURRING, JSON.stringify(list));
      return newItem;
    }

    deleteRecurring(id) {
      const list = this.getRecurring().filter(r => r.id !== id);
      this._setItem(KEYS.RECURRING, JSON.stringify(list));
    }

    checkAndGenerateRecurringTransactions() {
      const recurringList = this.getRecurring().filter(r => r.is_active);
      if (recurringList.length === 0) return 0;

      const todayStr = formatLocalYMD();
      const today = new Date();
      const currentDay = today.getDate();
      let generatedCount = 0;

      recurringList.forEach(rec => {
        if (rec.last_run_date && rec.last_run_date.substring(0, 7) === todayStr.substring(0, 7)) {
          return;
        }
        if (currentDay >= rec.day_of_month) {
          this.addTransaction({
            date: todayStr,
            type: rec.type,
            category: rec.category,
            amount: rec.amount,
            note: `[Tự động định kỳ] ${rec.note}`
          });
          rec.last_run_date = todayStr;
          this.saveRecurring(rec);
          generatedCount++;
        }
      });

      return generatedCount;
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
