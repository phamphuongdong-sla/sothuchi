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
    WALLET: 'stc_wallets',
    ASSET: 'stc_assets',
    LIABILITY: 'stc_liabilities',
    LOAN: 'stc_loans',
    RECURRING: 'stc_recurring',
    AUDIT: 'stc_audit_logs'
  };

  const DEFAULT_WALLETS = [
    { id: 'wallet_cash', name: 'Ví tiền mặt', type: 'cash', icon: '💵', color: '#10b981', initial_balance: 0, balance: 0, is_default: 1, is_hidden: 0 },
    { id: 'wallet_bank', name: 'Tài khoản Ngân hàng', type: 'bank', icon: '🏦', color: '#3b82f6', initial_balance: 0, balance: 0, is_default: 0, is_hidden: 0 },
    { id: 'wallet_momo', name: 'Ví MoMo / ZaloPay', type: 'ewallet', icon: '📱', color: '#ec4899', initial_balance: 0, balance: 0, is_default: 0, is_hidden: 0 },
    { id: 'wallet_credit', name: 'Thẻ tín dụng', type: 'credit', icon: '💳', color: '#f59e0b', initial_balance: 0, balance: 0, is_default: 0, is_hidden: 0 }
  ];

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
      if (!cleaned) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      return cleaned;
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
    const type = tx.type === 'transfer' ? 'transfer' : (tx.type === 'income' ? 'income' : 'expense');
    const amount = Number(tx.amount);
    const category = String(
      tx.category != null && tx.category !== ''
        ? tx.category
        : (type === 'income' ? 'Lương' : 'Ăn uống')
    ).trim();
    const walletId = String(tx.wallet_id || tx.walletId || 'wallet_cash');
    const walletName = String(tx.wallet_name || tx.walletName || 'Ví tiền mặt');

    return {
      id: String(tx.id || generateId('tx')),
      date: formatLocalYMD(tx.date),
      type,
      category,
      amount: isNaN(amount) ? 0 : amount,
      note: tx.note != null ? String(tx.note) : '',
      wallet_id: walletId,
      wallet_name: walletName,
      created_at: created,
      createdAt: created,
      updated_at: updated,
      updatedAt: updated,
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
        date: data.date || formatLocalYMD(),
        type: data.type === 'transfer' ? 'transfer' : (data.type === 'income' ? 'income' : 'expense'),
        category: data.category || (data.type === 'income' ? 'Lương' : 'Ăn uống'),
        amount,
        note: data.note || '',
        wallet_id: data.wallet_id || data.walletId || 'wallet_cash',
        wallet_name: data.wallet_name || data.walletName || 'Ví tiền mặt',
        created_at: data.created_at || data.createdAt || now,
        createdAt: data.createdAt || data.created_at || now,
        updated_at: data.updated_at || data.updatedAt || now,
        updatedAt: data.updatedAt || data.updated_at || now,
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
        ...current,
        ...data,
        amount,
        updated_at: now,
        updatedAt: now,
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

    // Wallets Management
    getWallets(includeHidden = false, includeDeleted = false) {
      const raw = this._getItem(KEYS.WALLET);
      let wallets = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) wallets = parsed;
        } catch (_) {}
      }
      if (wallets.length === 0) {
        wallets = JSON.parse(JSON.stringify(DEFAULT_WALLETS));
        this.saveWallets(wallets);
      }
      this.recalculateWalletBalances(wallets);
      let result = includeDeleted ? wallets : wallets.filter(w => !w.is_deleted && w.sync_status !== 'pending_delete');
      return includeHidden ? result : result.filter(w => !w.is_hidden);
    }

    getWallet(id) {
      const wallets = this.getWallets(true, true);
      return wallets.find(w => w.id === id) || wallets[0] || null;
    }

    saveWallets(wallets) {
      this._setItem(KEYS.WALLET, JSON.stringify(wallets || []));
    }

    saveWallet(data) {
      if (!data || !data.name) throw new Error('Tên ví không được để trống');
      const wallets = this.getWallets(true, true);
      const existingIdx = data.id ? wallets.findIndex(w => w.id === data.id) : -1;
      const existing = existingIdx !== -1 ? wallets[existingIdx] : null;
      const now = new Date().toISOString();

      let initialBalance;
      if (data.initial_balance !== undefined) {
        initialBalance = Number(data.initial_balance) || 0;
      } else if (existing && existing.initial_balance !== undefined) {
        initialBalance = Number(existing.initial_balance) || 0;
      } else {
        initialBalance = Number(data.balance || 0);
      }

      const newWallet = {
        id: data.id || generateId('wallet'),
        name: String(data.name).trim(),
        type: data.type || (existing ? existing.type : 'cash'),
        icon: data.icon || (existing ? existing.icon : '💵'),
        color: data.color || (existing ? existing.color : '#10b981'),
        initial_balance: initialBalance,
        balance: initialBalance,
        is_default: data.is_default !== undefined ? (data.is_default ? 1 : 0) : (existing ? existing.is_default : 0),
        is_hidden: data.is_hidden !== undefined ? (data.is_hidden ? 1 : 0) : (existing ? existing.is_hidden : 0),
        updated_at: now,
        sync_status: 'pending_update'
      };

      if (newWallet.is_default) {
        wallets.forEach(w => w.is_default = 0);
      }

      if (existingIdx !== -1) {
        wallets[existingIdx] = { ...wallets[existingIdx], ...newWallet };
      } else {
        wallets.push(newWallet);
      }
      this.recalculateWalletBalances(wallets);
      this.saveWallets(wallets);
      this.logAuditEvent(existingIdx !== -1 ? 'update' : 'add', 'wallet', newWallet.id, existing, newWallet);
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return wallets.find(w => w.id === newWallet.id) || newWallet;
    }

    deleteWallet(id) {
      let wallets = this.getWallets(true, true);
      const activeWallets = wallets.filter(w => !w.is_deleted && w.sync_status !== 'pending_delete');
      if (activeWallets.length <= 1) throw new Error('Cần giữ lại ít nhất 1 ví trong hệ thống');

      const idx = wallets.findIndex(w => w.id === id);
      const target = idx !== -1 ? wallets[idx] : null;
      if (idx !== -1) {
        if (target.sync_status === 'synced' || target.updated_at) {
          wallets[idx] = {
            ...target,
            is_deleted: 1,
            sync_status: 'pending_delete',
            updated_at: new Date().toISOString()
          };
        } else {
          wallets.splice(idx, 1);
        }
      }
      if (!wallets.some(w => w.is_default && !w.is_deleted && w.sync_status !== 'pending_delete')) {
        const active = wallets.find(w => !w.is_deleted && w.sync_status !== 'pending_delete');
        if (active) active.is_default = 1;
      }
      this.saveWallets(wallets);
      this.logAuditEvent('delete', 'wallet', id, target, null);
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return true;
    }

    recalculateWalletBalances(walletsList) {
      const txs = this.getTransactions();
      const balanceMap = new Map();
      (walletsList || []).forEach(w => balanceMap.set(w.id, Number(w.initial_balance || 0)));

      txs.forEach(tx => {
        const wId = tx.wallet_id || 'wallet_cash';
        const current = balanceMap.has(wId) ? balanceMap.get(wId) : 0;
        if (tx.type === 'income') {
          balanceMap.set(wId, current + tx.amount);
        } else if (tx.type === 'expense') {
          balanceMap.set(wId, current - tx.amount);
        }
      });

      (walletsList || []).forEach(w => {
        w.balance = balanceMap.has(w.id) ? balanceMap.get(w.id) : Number(w.initial_balance || 0);
      });
    }

    transferBetweenWallets(fromId, toId, amount, note, date) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error('Số tiền chuyển phải > 0');
      if (fromId === toId) throw new Error('Ví nguồn và ví đích không được trùng nhau');

      const fromWallet = this.getWallet(fromId);
      const toWallet = this.getWallet(toId);
      if (!fromWallet || !toWallet) throw new Error('Ví không hợp lệ');

      const nowDate = formatLocalYMD(date);
      const transferNote = note ? `Chuyển sang ${toWallet.name}: ${note}` : `Chuyển tiền sang ${toWallet.name}`;
      const receiveNote = note ? `Nhận từ ${fromWallet.name}: ${note}` : `Nhận tiền từ ${fromWallet.name}`;

      const outTx = this.addTransaction({
        date: nowDate,
        type: 'expense',
        category: 'Chuyển tiền nội bộ',
        amount: numAmount,
        note: transferNote,
        wallet_id: fromWallet.id,
        wallet_name: fromWallet.name
      });

      const inTx = this.addTransaction({
        date: nowDate,
        type: 'income',
        category: 'Chuyển tiền nội bộ',
        amount: numAmount,
        note: receiveNote,
        wallet_id: toWallet.id,
        wallet_name: toWallet.name
      });

      return { outTx, inTx };
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
    getAssets(includeDeleted = false) {
      const raw = this._getItem(KEYS.ASSET);
      if (!raw) return [];
      try {
        const list = JSON.parse(raw) || [];
        if (includeDeleted) return list;
        return list.filter(a => !a.is_deleted && a.sync_status !== 'pending_delete');
      } catch (_) { return []; }
    }

    saveAsset(data) {
      const assets = this.getAssets(true);
      const id = data.id || generateId('asset');
      const now = new Date().toISOString();
      const newAsset = {
        id,
        name: String(data.name || 'Tài sản').trim(),
        category: data.category || 'Tài khoản ngân hàng',
        value: Math.max(0, Number(data.value) || 0),
        note: data.note || '',
        updated_at: now,
        sync_status: 'pending_update'
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
      const assets = this.getAssets(true);
      const idx = assets.findIndex(a => a.id === id);
      if (idx !== -1) {
        const item = assets[idx];
        if (item.sync_status === 'synced' || item.updated_at) {
          assets[idx] = {
            ...item,
            is_deleted: 1,
            sync_status: 'pending_delete',
            updated_at: new Date().toISOString()
          };
        } else {
          assets.splice(idx, 1);
        }
        this._setItem(KEYS.ASSET, JSON.stringify(assets));
      }
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
    }

    getLiabilities(includeDeleted = false) {
      const raw = this._getItem(KEYS.LIABILITY);
      if (!raw) return [];
      try {
        const list = JSON.parse(raw) || [];
        if (includeDeleted) return list;
        return list.filter(l => !l.is_deleted && l.sync_status !== 'pending_delete');
      } catch (_) { return []; }
    }

    saveLiability(data) {
      const liabilities = this.getLiabilities(true);
      const id = data.id || generateId('liab');
      const now = new Date().toISOString();
      const newLiab = {
        id,
        name: String(data.name || 'Khoản nợ').trim(),
        category: data.category || 'Thẻ tín dụng',
        total_debt: Math.max(0, Number(data.total_debt || data.value) || 0),
        remaining_debt: Math.max(0, Number(data.remaining_debt ?? data.value) || 0),
        note: data.note || '',
        updated_at: now,
        sync_status: 'pending_update'
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
      const liabilities = this.getLiabilities(true);
      const idx = liabilities.findIndex(l => l.id === id);
      if (idx !== -1) {
        const item = liabilities[idx];
        if (item.sync_status === 'synced' || item.updated_at) {
          liabilities[idx] = {
            ...item,
            is_deleted: 1,
            sync_status: 'pending_delete',
            updated_at: new Date().toISOString()
          };
        } else {
          liabilities.splice(idx, 1);
        }
        this._setItem(KEYS.LIABILITY, JSON.stringify(liabilities));
      }
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
    getLoans(includeDeleted = false) {
      const raw = this._getItem(KEYS.LOAN);
      if (!raw) return [];
      try {
        const list = JSON.parse(raw) || [];
        if (includeDeleted) return list;
        return list.filter(l => !l.is_deleted && l.sync_status !== 'pending_delete');
      } catch (_) { return []; }
    }

    saveLoan(data) {
      const loans = this.getLoans(true);
      const id = data.id || generateId('loan');
      const now = new Date().toISOString();
      const existing = loans.find(l => l.id === id);

      const originalAmount = Math.max(0, Number(data.original_amount !== undefined ? data.original_amount : (existing ? existing.original_amount : 0)) || 0);

      let remainingAmount;
      if (data.remaining_amount !== undefined) {
        remainingAmount = Math.max(0, Number(data.remaining_amount) || 0);
      } else if (existing && existing.remaining_amount !== undefined) {
        remainingAmount = Math.max(0, Number(existing.remaining_amount) || 0);
      } else {
        remainingAmount = originalAmount;
      }

      const repayments = data.repayments !== undefined
        ? (Array.isArray(data.repayments) ? data.repayments : [])
        : (existing && Array.isArray(existing.repayments) ? existing.repayments : []);

      const newLoan = {
        id,
        type: data.type || (existing ? existing.type : 'debt'),
        person_name: String(data.person_name !== undefined ? data.person_name : (existing ? existing.person_name : 'Đối tác')).trim(),
        original_amount: originalAmount,
        remaining_amount: remainingAmount,
        due_date: data.due_date !== undefined ? data.due_date : (existing ? existing.due_date : ''),
        note: data.note !== undefined ? data.note : (existing ? existing.note : ''),
        status: remainingAmount <= 0 ? 'paid' : (data.status || (existing ? existing.status : 'active')),
        repayments: repayments,
        updated_at: now,
        sync_status: 'pending_update'
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
      const loans = this.getLoans(true);
      const idx = loans.findIndex(l => l.id === id);
      if (idx !== -1) {
        const item = loans[idx];
        if (item.sync_status === 'synced' || item.updated_at) {
          loans[idx] = {
            ...item,
            is_deleted: 1,
            sync_status: 'pending_delete',
            updated_at: new Date().toISOString()
          };
        } else {
          loans.splice(idx, 1);
        }
        this._setItem(KEYS.LOAN, JSON.stringify(loans));
      }
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
    }

    recordLoanRepayment(loanId, repaymentData) {
      const loans = this.getLoans(true);
      const idx = loans.findIndex(l => l.id === loanId);
      if (idx === -1) throw new Error('Không tìm thấy khoản vay');

      const target = loans[idx];
      const principal = Math.max(0, Number(repaymentData.principal) || 0);
      const interest = Math.max(0, Number(repaymentData.interest) || 0);
      const date = repaymentData.date || formatLocalYMD();

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
      target.sync_status = 'pending_update';

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
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return target;
    }

    // Recurring Automated Ledger
    getRecurring(includeDeleted = false) {
      const raw = this._getItem(KEYS.RECURRING);
      if (!raw) return [];
      try {
        const list = JSON.parse(raw) || [];
        if (includeDeleted) return list;
        return list.filter(r => !r.is_deleted && r.sync_status !== 'pending_delete');
      } catch (_) { return []; }
    }

    saveRecurring(data) {
      const list = this.getRecurring(true);
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
        is_active: data.is_active !== false,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_update'
      };
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) list[idx] = newItem;
      else list.push(newItem);
      this._setItem(KEYS.RECURRING, JSON.stringify(list));
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
      return newItem;
    }

    deleteRecurring(id) {
      const list = this.getRecurring(true);
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        const item = list[idx];
        if (item.sync_status === 'synced' || item.updated_at) {
          list[idx] = {
            ...item,
            is_deleted: 1,
            sync_status: 'pending_delete',
            updated_at: new Date().toISOString()
          };
        } else {
          list.splice(idx, 1);
        }
        this._setItem(KEYS.RECURRING, JSON.stringify(list));
      }
      if (typeof window !== 'undefined' && window.SyncEngine?.pushSync) {
        window.SyncEngine.pushSync().catch(() => {});
      }
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

      // 1. Wallets
      sql += `-- Bảng Wallets\n`;
      sql += `CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY, name TEXT, type TEXT, icon TEXT, color TEXT, balance REAL, is_default INTEGER, is_hidden INTEGER);\n`;
      const wallets = this.getWallets(true);
      wallets.forEach(w => {
        sql += `INSERT OR REPLACE INTO wallets VALUES (${escape(w.id)}, ${escape(w.name)}, ${escape(w.type)}, ${escape(w.icon)}, ${escape(w.color)}, ${w.balance || 0}, ${w.is_default ? 1 : 0}, ${w.is_hidden ? 1 : 0});\n`;
      });
      sql += `\n`;

      // 2. Transactions
      sql += `-- Bảng Transactions\n`;
      sql += `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, category TEXT, amount REAL, note TEXT, wallet_id TEXT, wallet_name TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);\n`;
      const txs = this._loadAll();
      txs.forEach(t => {
        sql += `INSERT OR REPLACE INTO transactions VALUES (${escape(t.id)}, ${escape(t.date)}, ${escape(t.type)}, ${escape(t.category)}, ${t.amount || 0}, ${escape(t.note)}, ${escape(t.wallet_id || 'wallet_cash')}, ${escape(t.wallet_name || 'Ví tiền mặt')}, ${escape(t.created_at)}, ${escape(t.updated_at)}, ${escape(t.sync_status)});\n`;
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

      const lines = sqlText.split('\n');
      const txs = [];
      const wallets = [];
      const categories = [];
      const assets = [];
      const liabilities = [];
      const loans = [];
      const recurring = [];

      const parseTokens = (rawVals) => {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < rawVals.length; i++) {
          const char = rawVals[i];
          if (char === "'" && inQuotes && rawVals[i + 1] === "'") {
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
        if (current.trim()) tokens.push(current.trim());
        return tokens;
      };

      const unescape = (val) => {
        if (!val || val === 'NULL') return '';
        if (val.startsWith("'") && val.endsWith("'")) {
          return val.slice(1, -1).replace(/''/g, "'");
        }
        return val;
      };

      lines.forEach(line => {
        const trimmed = line.trim();
        const match = trimmed.match(/^INSERT (?:OR REPLACE )?INTO (\w+)\s*VALUES\s*\((.+)\);?$/i);
        if (!match) return;

        const table = match[1].toLowerCase();
        const rawVals = match[2];
        const tokens = parseTokens(rawVals);

        if (table === 'transactions') {
          if (tokens.length >= 11) {
            txs.push({
              id: unescape(tokens[0]),
              date: unescape(tokens[1]),
              type: unescape(tokens[2]),
              category: unescape(tokens[3]),
              amount: parseFloat(tokens[4]) || 0,
              note: unescape(tokens[5]),
              wallet_id: unescape(tokens[6]) || 'wallet_cash',
              wallet_name: unescape(tokens[7]) || 'Ví tiền mặt',
              created_at: unescape(tokens[8]),
              updated_at: unescape(tokens[9]),
              sync_status: unescape(tokens[10]) || 'pending_add'
            });
          } else if (tokens.length >= 8) {
            txs.push({
              id: unescape(tokens[0]),
              date: unescape(tokens[1]),
              type: unescape(tokens[2]),
              category: unescape(tokens[3]),
              amount: parseFloat(tokens[4]) || 0,
              note: unescape(tokens[5]),
              wallet_id: 'wallet_cash',
              wallet_name: 'Ví tiền mặt',
              created_at: unescape(tokens[6]),
              updated_at: unescape(tokens[7]),
              sync_status: unescape(tokens[8]) || 'pending_add'
            });
          }
        } else if (table === 'wallets' && tokens.length >= 6) {
          wallets.push({
            id: unescape(tokens[0]),
            name: unescape(tokens[1]),
            type: unescape(tokens[2]),
            icon: unescape(tokens[3]),
            color: unescape(tokens[4]),
            initial_balance: parseFloat(tokens[5]) || 0,
            balance: parseFloat(tokens[5]) || 0,
            is_default: parseInt(tokens[6], 10) === 1 ? 1 : 0,
            is_hidden: parseInt(tokens[7], 10) === 1 ? 1 : 0
          });
        } else if (table === 'categories' && tokens.length >= 5) {
          categories.push({
            id: unescape(tokens[0]),
            name: unescape(tokens[1]),
            type: unescape(tokens[2]),
            icon: unescape(tokens[3]),
            color: unescape(tokens[4]),
            is_hidden: parseInt(tokens[5], 10) === 1,
            sort_order: parseInt(tokens[6], 10) || 0
          });
        } else if (table === 'assets' && tokens.length >= 4) {
          assets.push({
            id: unescape(tokens[0]),
            name: unescape(tokens[1]),
            category: unescape(tokens[2]),
            value: parseFloat(tokens[3]) || 0,
            note: unescape(tokens[4]),
            updated_at: unescape(tokens[5])
          });
        } else if (table === 'liabilities' && tokens.length >= 5) {
          liabilities.push({
            id: unescape(tokens[0]),
            name: unescape(tokens[1]),
            category: unescape(tokens[2]),
            total_debt: parseFloat(tokens[3]) || 0,
            remaining_debt: parseFloat(tokens[4]) || 0,
            note: unescape(tokens[5]),
            updated_at: unescape(tokens[6])
          });
        } else if (table === 'loans' && tokens.length >= 8) {
          let repayments = [];
          try { repayments = JSON.parse(unescape(tokens[8]) || '[]'); } catch (_) {}
          loans.push({
            id: unescape(tokens[0]),
            type: unescape(tokens[1]),
            person_name: unescape(tokens[2]),
            original_amount: parseFloat(tokens[3]) || 0,
            remaining_amount: parseFloat(tokens[4]) || 0,
            due_date: unescape(tokens[5]),
            note: unescape(tokens[6]),
            status: unescape(tokens[7]),
            repayments: Array.isArray(repayments) ? repayments : [],
            updated_at: unescape(tokens[9])
          });
        } else if (table === 'recurring' && tokens.length >= 7) {
          recurring.push({
            id: unescape(tokens[0]),
            type: unescape(tokens[1]),
            amount: parseFloat(tokens[2]) || 0,
            category: unescape(tokens[3]),
            note: unescape(tokens[4]),
            frequency: unescape(tokens[5]),
            day_of_month: parseInt(tokens[6], 10) || 1,
            last_run_date: unescape(tokens[7]),
            is_active: parseInt(tokens[8], 10) !== 0
          });
        }
      });

      if (wallets.length > 0) {
        const existingWallets = this.getWallets(true);
        const map = new Map(existingWallets.map(w => [w.id, w]));
        wallets.forEach(w => map.set(w.id, { ...map.get(w.id), ...w }));
        this.saveWallets(Array.from(map.values()));
      }

      if (categories.length > 0) {
        this.saveCategories(categories);
      }

      if (assets.length > 0) {
        const existing = this.getAssets();
        const map = new Map(existing.map(a => [a.id, a]));
        assets.forEach(a => map.set(a.id, a));
        this._setItem(KEYS.ASSET, JSON.stringify(Array.from(map.values())));
      }

      if (liabilities.length > 0) {
        const existing = this.getLiabilities();
        const map = new Map(existing.map(l => [l.id, l]));
        liabilities.forEach(l => map.set(l.id, l));
        this._setItem(KEYS.LIABILITY, JSON.stringify(Array.from(map.values())));
      }

      if (loans.length > 0) {
        const existing = this.getLoans();
        const map = new Map(existing.map(l => [l.id, l]));
        loans.forEach(l => map.set(l.id, l));
        this._setItem(KEYS.LOAN, JSON.stringify(Array.from(map.values())));
      }

      if (recurring.length > 0) {
        const existing = this.getRecurring();
        const map = new Map(existing.map(r => [r.id, r]));
        recurring.forEach(r => map.set(r.id, r));
        this._setItem(KEYS.RECURRING, JSON.stringify(Array.from(map.values())));
      }

      if (txs.length > 0) {
        const existing = this._loadAll();
        const map = new Map(existing.map(t => [t.id, t]));
        txs.forEach(t => map.set(t.id, normalizeTransaction(t)));
        const merged = Array.from(map.values());
        this.saveTransactions(merged);
        const allWallets = this.getWallets(true);
        this.recalculateWalletBalances(allWallets);
        this.saveWallets(allWallets);
      }

      return {
        imported_transactions: txs.length,
        imported_wallets: wallets.length,
        imported_categories: categories.length,
        imported_assets: assets.length,
        imported_liabilities: liabilities.length,
        imported_loans: loans.length,
        imported_recurring: recurring.length
      };
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
