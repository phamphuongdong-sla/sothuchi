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
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return newAsset;
    }

    deleteAsset(id) {
      const assets = this.getAssets().filter(a => a.id !== id);
      this._setItem(KEYS.ASSET, JSON.stringify(assets));
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
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
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return newLiab;
    }

    deleteLiability(id) {
      const liabilities = this.getLiabilities().filter(l => l.id !== id);
      this._setItem(KEYS.LIABILITY, JSON.stringify(liabilities));
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
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
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return newLoan;
    }

    deleteLoan(id) {
      const loans = this.getLoans().filter(l => l.id !== id);
      this._setItem(KEYS.LOAN, JSON.stringify(loans));
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
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

    /**
     * SQLite Export SQL Dump (.sql)
     * Generates standard SQLite DDL & DML INSERT statements for all tables.
     */
    exportSql() {
      const escape = (val) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? '1' : '0';
        return "'" + String(val).replace(/'/g, "''") + "'";
      };

      let sql = `-- ============================================================================\n`;
      sql += `-- SỔ THU CHI CÁ NHÂN - SQLITE DUMP EXPORT\n`;
      sql += `-- Generated on: ${new Date().toISOString()}\n`;
      sql += `-- ============================================================================\n\n`;

      // 1. Transactions
      sql += `-- Bảng Transactions\n`;
      sql += `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, category TEXT, amount REAL, note TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);\n`;
      const txs = this._loadAll();
      txs.forEach(t => {
        sql += `INSERT OR REPLACE INTO transactions VALUES (${escape(t.id)}, ${escape(t.date)}, ${escape(t.type)}, ${escape(t.category)}, ${t.amount || 0}, ${escape(t.note)}, ${escape(t.created_at)}, ${escape(t.updated_at)}, ${escape(t.sync_status)});\n`;
      });
      sql += `\n`;

      // 2. Categories
      sql += `-- Bảng Categories\n`;
      sql += `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, icon TEXT, color TEXT, is_hidden INTEGER, sort_order INTEGER);\n`;
      const cats = this.getCategories(true);
      cats.forEach(c => {
        sql += `INSERT OR REPLACE INTO categories VALUES (${escape(c.id)}, ${escape(c.name)}, ${escape(c.type)}, ${escape(c.icon)}, ${escape(c.color)}, ${c.is_hidden || c.isHidden ? 1 : 0}, ${c.sort_order || 0});\n`;
      });
      sql += `\n`;

      // 3. Assets
      sql += `-- Bảng Assets\n`;
      sql += `CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT, category TEXT, value REAL, note TEXT, updated_at TEXT);\n`;
      this.getAssets().forEach(a => {
        sql += `INSERT OR REPLACE INTO assets VALUES (${escape(a.id)}, ${escape(a.name)}, ${escape(a.category)}, ${a.value || 0}, ${escape(a.note)}, ${escape(a.updated_at)});\n`;
      });
      sql += `\n`;

      // 4. Liabilities
      sql += `-- Bảng Liabilities\n`;
      sql += `CREATE TABLE IF NOT EXISTS liabilities (id TEXT PRIMARY KEY, name TEXT, category TEXT, total_debt REAL, remaining_debt REAL, note TEXT, updated_at TEXT);\n`;
      this.getLiabilities().forEach(l => {
        sql += `INSERT OR REPLACE INTO liabilities VALUES (${escape(l.id)}, ${escape(l.name)}, ${escape(l.category)}, ${l.total_debt || 0}, ${l.remaining_debt || 0}, ${escape(l.note)}, ${escape(l.updated_at)});\n`;
      });
      sql += `\n`;

      // 5. Loans
      sql += `-- Bảng Loans\n`;
      sql += `CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY, type TEXT, person_name TEXT, original_amount REAL, remaining_amount REAL, due_date TEXT, note TEXT, status TEXT, repayments_json TEXT, updated_at TEXT);\n`;
      this.getLoans().forEach(l => {
        sql += `INSERT OR REPLACE INTO loans VALUES (${escape(l.id)}, ${escape(l.type)}, ${escape(l.person_name)}, ${l.original_amount || 0}, ${l.remaining_amount || 0}, ${escape(l.due_date)}, ${escape(l.note)}, ${escape(l.status)}, ${escape(JSON.stringify(l.repayments || []))}, ${escape(l.updated_at)});\n`;
      });
      sql += `\n`;

      // 6. Recurring
      sql += `-- Bảng Recurring\n`;
      sql += `CREATE TABLE IF NOT EXISTS recurring (id TEXT PRIMARY KEY, type TEXT, amount REAL, category TEXT, note TEXT, frequency TEXT, day_of_month INTEGER, last_run_date TEXT, is_active INTEGER);\n`;
      this.getRecurring().forEach(r => {
        sql += `INSERT OR REPLACE INTO recurring VALUES (${escape(r.id)}, ${escape(r.type)}, ${r.amount || 0}, ${escape(r.category)}, ${escape(r.note)}, ${escape(r.frequency)}, ${r.day_of_month || 1}, ${escape(r.last_run_date)}, ${r.is_active ? 1 : 0});\n`;
      });

      return sql;
    }

    /**
     * SQLite Import SQL / JSON File
     */
    importSql(sqlText) {
      if (!sqlText || typeof sqlText !== 'string') throw new Error('Nội dung SQL không hợp lệ');

      // Simple parser for INSERT INTO statements from dump
      const lines = sqlText.split('\n');
      const txs = [];
      const cats = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('INSERT INTO transactions') || trimmed.startsWith('INSERT OR REPLACE INTO transactions')) {
          // Parse values
          const match = trimmed.match(/VALUES\s*\((.+)\);$/i);
          if (match) {
            const rawVals = match[1];
            // Primitive SQL value tokenizer
            const tokens = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < rawVals.length; i++) {
              const char = rawVals[i];
              if (char === "'" && rawVals[i + 1] === "'") {
                current += "'";
                i++;
              } else if (char === "'") {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                tokens.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            if (current) tokens.push(current.trim());

            if (tokens.length >= 8) {
              txs.push({
                id: tokens[0].replace(/^'|'$/g, ''),
                date: tokens[1].replace(/^'|'$/g, ''),
                type: tokens[2].replace(/^'|'$/g, ''),
                category: tokens[3].replace(/^'|'$/g, ''),
                amount: parseFloat(tokens[4]) || 0,
                note: tokens[5].replace(/^'|'$/g, ''),
                created_at: tokens[6].replace(/^'|'$/g, ''),
                updated_at: tokens[7].replace(/^'|'$/g, ''),
                sync_status: tokens[8] ? tokens[8].replace(/^'|'$/g, '') : 'pending_add'
              });
            }
          }
        }
      });

      if (txs.length > 0) {
        const existing = this._loadAll();
        const map = new Map(existing.map(t => [t.id, t]));
        txs.forEach(t => map.set(t.id, t));
        const merged = Array.from(map.values());
        this.saveTransactions(merged);
      }

      return { imported_transactions: txs.length };
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
