/**
 * js/sync.js - Google Sheets 2-Way Sync Engine
 * Manages Settings persistence, GAS endpoint validation, ping test,
 * 2-way sync (push/pull) with LWW conflict resolution, and auto-sync triggers.
 */

(function (global) {
  'use strict';

  class SyncEngine {
    static MAX_RETRIES = 5;

    constructor() {
      this.STORAGE_KEY = 'stc_settings';
      this.LEGACY_KEY = 'so_thu_chi_settings';
      this.MAX_RETRIES = 5;
      this.maxRetries = 5;
      this.isSyncing = false;
      this.hasPendingSyncRequest = false;
      this._initListeners();
    }

    /**
     * Validate a Google Apps Script or Cloudflare D1 SQLite Endpoint URL.
     */
    validateUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const t = url.trim();
      return (t.startsWith('https://') || t.startsWith('http://')) && t.length > 10;
    }

    /**
     * Save settings to LocalStorage.
     */
    saveSettings(settings = {}) {
      const current = this.getSettings();
      const updated = {
        gasUrl: settings.gasUrl !== undefined ? settings.gasUrl.trim() : current.gasUrl,
        autoSync: settings.autoSync !== undefined ? Boolean(settings.autoSync) : current.autoSync
      };
      try {
        const s = global.localStorage;
        if (s) {
          s.setItem(this.STORAGE_KEY, JSON.stringify(updated));
          s.setItem(this.LEGACY_KEY, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('[SyncEngine] Failed to save settings:', e);
      }
      this._updateStatus('idle');
      return updated;
    }

    /**
     * Load settings from LocalStorage.
     */
    getSettings() {
      const DEFAULT_URL = 'https://sothuchi-sqlite-backend.mrdong-sothuchi.workers.dev';
      try {
        const s = global.localStorage;
        if (s) {
          const data = s.getItem(this.STORAGE_KEY) || s.getItem(this.LEGACY_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            return {
              gasUrl: parsed.gasUrl ?? DEFAULT_URL,
              autoSync: parsed.autoSync !== undefined ? Boolean(parsed.autoSync) : true
            };
          }
        }
      } catch (e) {
        console.error('[SyncEngine] Failed to parse settings:', e);
      }
      return { gasUrl: DEFAULT_URL, autoSync: true };
    }

    _getFetch() {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        return window.fetch.bind(window);
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
        return globalThis.fetch;
      }
      return fetch;
    }

    /**
     * Test connection to Endpoint (GAS or Cloudflare D1 SQLite Worker) via ping.
     */
    async testConnection(url) {
      const endpoint = url || this.getSettings().gasUrl;
      if (!this.validateUrl(endpoint)) throw new Error('URL Endpoint không hợp lệ');

      let targetUrl = endpoint;
      if (endpoint.includes('workers.dev') || endpoint.includes('/api/')) {
        targetUrl = endpoint.endsWith('/api/ping') ? endpoint : `${endpoint.replace(/\/$/, '')}/api/ping`;
      } else {
        const sep = endpoint.includes('?') ? '&' : '?';
        targetUrl = endpoint + sep + 'action=ping';
      }

      const res = await this._getFetch()(targetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();
      if (json.status === 'error') throw new Error(json.message || 'Kết nối thất bại');
      return json.status === 'ok' || json.status === 'success';
    }

    /**
     * Push local pending transactions to GAS backend.
     */
    async pushSync() {
      if (this.isSyncing) {
        this.hasPendingSyncRequest = true;
        return { success: false, reason: 'Sync already in progress' };
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._updateStatus('offline');
        return { success: false, reason: 'Offline' };
      }

      const settings = this.getSettings();
      if (!this.validateUrl(settings.gasUrl)) {
        return { success: false, reason: 'Invalid endpoint URL' };
      }

      const db = global.DB;
      if (!db) return { success: false, reason: 'DB module not available' };

      const all = db.getTransactions({ includeDeleted: true });
      const pending = all.filter(t => t.sync_status && t.sync_status !== 'synced');
      const deduped = Array.from(new Map(pending.map(t => [t.id, t])).values());

      const wallets = db.getWallets ? db.getWallets(true) : [];
      const assets = db.getAssets ? db.getAssets() : [];
      const liabilities = db.getLiabilities ? db.getLiabilities() : [];
      const loans = db.getLoans ? db.getLoans() : [];
      const auditLogs = db.getAuditLogs ? db.getAuditLogs() : [];

      if (!deduped.length && !wallets.length && !assets.length && !liabilities.length && !loans.length && !auditLogs.length) {
        this._updateStatus('success');
        return { success: true, syncedCount: 0 };
      }

      this.isSyncing = true;
      this._updateStatus('syncing');

      const payloadObj = {
        action: 'syncBatch',
        transactions: deduped,
        wallets: wallets,
        assets: assets,
        liabilities: liabilities,
        loans: loans,
        auditLogs: auditLogs
      };

      const payload = JSON.stringify(payloadObj);
      let result = null;

      // Try GET for small payloads
      if (payload.length < 1000) {
        try {
          const sep = settings.gasUrl.includes('?') ? '&' : '?';
          const res = await this._getFetch()(settings.gasUrl + sep + 'action=syncBatch&payload=' + encodeURIComponent(payload));
          if (res.ok) {
            const json = await res.json();
            if (json.status === 'success') result = json;
          }
        } catch (_) {}
      }

      // Fall back to POST
      if (!result) {
        try {
          const res = await this._getFetch()(settings.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
          });
          if (!res.ok) throw new Error(`Push HTTP ${res.status}`);
          const json = await res.json();
          if (json.status === 'success') result = json;
          else throw new Error(json.message || 'Lỗi push sync từ server');
        } catch (err) {
          this.isSyncing = false;
          this._updateStatus('error');
          const isAuthErr = /SyntaxError|<|Unexpected token/.test(err.message);
          return {
            success: false,
            error: isAuthErr
              ? 'Không thể kết nối SQLite Cloud. Vui lòng kiểm tra lại URL Endpoint!'
              : err.message
          };
        }
      }

      const syncedIds = result.synced_ids || deduped.map(t => t.id);
      if (syncedIds.length > 0) {
        const updated = db.getTransactions({ includeDeleted: true })
          .map(t => {
            if (!syncedIds.includes(t.id)) return t;
            return t.sync_status === 'pending_delete' ? null : { ...t, sync_status: 'synced' };
          })
          .filter(Boolean);

        db.saveTransactions(updated, { skipAutoPush: true });
      }

      this.isSyncing = false;
      this._updateStatus('success');

      if (this.hasPendingSyncRequest) {
        this.hasPendingSyncRequest = false;
        setTimeout(() => this.pushSync().catch(() => {}), 50);
      }

      return { success: true, syncedCount: syncedIds.length };
    }

    /**
     * Pull remote transactions, categories, assets, liabilities, loans from SQLite backend and merge using LWW.
     */
    async pullSync() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._updateStatus('offline');
        return { success: false, reason: 'Offline' };
      }

      const settings = this.getSettings();
      if (!this.validateUrl(settings.gasUrl)) {
        return { success: false, reason: 'Invalid endpoint URL' };
      }

      const db = global.DB;
      if (!db) return { success: false, reason: 'DB module not available' };

      this.isSyncing = true;
      this._updateStatus('syncing');

      try {
        const sep = settings.gasUrl.includes('?') ? '&' : '?';
        const res = await this._getFetch()(settings.gasUrl + sep + 'action=fetchAll');
        if (!res.ok) throw new Error(`Pull HTTP ${res.status}`);

        const json = await res.json();
        if (json.status !== 'success' || !Array.isArray(json.transactions)) {
          throw new Error(json.message || 'Lỗi pull sync từ server');
        }

        const remoteTxs = json.transactions;
        const localTxs = db.getTransactions({ includeDeleted: true });
        const localMap = new Map(localTxs.map(t => [t.id, t]));

        if (remoteTxs.length > 0) {
          const remoteIds = new Set(remoteTxs.map(r => String(r.id)));
          
          localTxs.forEach(local => {
            if (local.sync_status === 'pending_delete') {
              if (!remoteIds.has(String(local.id))) {
                localMap.delete(local.id); // Deletion confirmed
              }
            } else if (local.sync_status === 'synced' && !remoteIds.has(String(local.id))) {
              // Local transaction was not found on remote server -> Mark as pending_add to upload!
              localMap.set(local.id, { ...local, sync_status: 'pending_add' });
            }
          });

          // Merge remote transactions using Last-Write-Wins (LWW)
          remoteTxs.forEach(remote => {
            const local = localMap.get(remote.id);
            if (!local) {
              localMap.set(remote.id, { ...remote, sync_status: 'synced' });
            } else {
              const remoteTime = new Date(remote.updated_at || 0).getTime();
              const localTime = new Date(local.updated_at || 0).getTime();
              if (remoteTime > localTime || (remoteTime === localTime && local.sync_status === 'synced')) {
                localMap.set(remote.id, { ...remote, sync_status: 'synced' });
              }
            }
          });
        } else if (localTxs.length > 0) {
          // Server returned 0 transactions, but local has data -> Keep local & push to server!
          localTxs.forEach(local => {
            if (local.sync_status !== 'pending_delete') {
              localMap.set(local.id, { ...local, sync_status: 'pending_add' });
            }
          });
          setTimeout(() => this.pushSync().catch(() => {}), 100);
        }

        const merged = Array.from(localMap.values());
        db.saveTransactions(merged, { skipAutoPush: true });

        try {
          window.dispatchEvent(new CustomEvent('transactionschanged', { detail: { transactions: merged } }));
          window.dispatchEvent(new CustomEvent('transactionupdated'));
          window.dispatchEvent(new CustomEvent('transactiondeleted'));
        } catch (_) {}

        // Merge remote categories if available
        if (Array.isArray(json.categories) && json.categories.length > 0) {
          const catMgr = global.CategoryManager;
          catMgr?.mergeRemoteCategories?.(json.categories);
        }

        // Merge remote wallets if available
        if (Array.isArray(json.wallets) && json.wallets.length > 0 && db.getWallets) {
          const existingWallets = db.getWallets(true);
          const walletMap = new Map(existingWallets.map(w => [w.id, w]));
          json.wallets.forEach(w => walletMap.set(w.id, w));
          db.saveWallets(Array.from(walletMap.values()));
        }

        // Merge remote assets, liabilities, loans if available
        if (Array.isArray(json.assets) && json.assets.length > 0 && db.getAssets) {
          const existingAssets = db.getAssets();
          const assetMap = new Map(existingAssets.map(a => [a.id, a]));
          json.assets.forEach(a => assetMap.set(a.id, a));
          db._setItem('stc_assets', JSON.stringify(Array.from(assetMap.values())));
        }
        if (Array.isArray(json.liabilities) && json.liabilities.length > 0 && db.getLiabilities) {
          const existingLiab = db.getLiabilities();
          const liabMap = new Map(existingLiab.map(l => [l.id, l]));
          json.liabilities.forEach(l => liabMap.set(l.id, l));
          db._setItem('stc_liabilities', JSON.stringify(Array.from(liabMap.values())));
        }
        if (Array.isArray(json.loans) && json.loans.length > 0 && db.getLoans) {
          const existingLoans = db.getLoans();
          const loanMap = new Map(existingLoans.map(l => [l.id, l]));
          json.loans.forEach(l => loanMap.set(l.id, l));
          db._setItem('stc_loans', JSON.stringify(Array.from(loanMap.values())));
        }

        this.isSyncing = false;
        this._updateStatus('success');
        return { success: true, pulledCount: remoteTxs.length };
      } catch (err) {
        this.isSyncing = false;
        this._updateStatus('error');
        return { success: false, error: err.message };
      }
    }

    /**
     * Full 2-way sync: push then pull.
     */
    async sync() {
      const push = await this.pushSync();
      const pull = await this.pullSync();
      return { push, pull, success: push.success !== false && pull.success !== false };
    }

    async syncAll() {
      return this.sync();
    }

    /**
     * Update the sync status indicator element.
     */
    _updateStatus(state) {
      const el = global.document?.getElementById('sync-status');
      if (!el) return;

      el.className = `sync-status status-${state}`;
      const titles = {
        syncing: '🔄 Đang đồng bộ với SQLite Cloud...',
        success: '✅ Đã đồng bộ thành công',
        error: '⚠️ Lỗi đồng bộ',
        offline: '📡 Ngoại tuyến',
        idle: '🌐 Sẵn sàng đồng bộ'
      };
      const texts = {
        syncing: 'Đang đồng bộ...', success: 'Đã đồng bộ',
        error: 'Lỗi đồng bộ', offline: 'Ngoại tuyến', idle: 'Sẵn sàng'
      };
      el.setAttribute('title', titles[state] || 'Trạng thái đồng bộ');

      const textNode = el.querySelector('.status-text');
      if (textNode) textNode.textContent = texts[state] || 'Sẵn sàng';
      else el.innerHTML = `<span class="status-dot"></span><span class="status-text">${texts[state] || 'Sẵn sàng'}</span>`;
    }

    /**
     * Register network and UI event listeners.
     */
    _initListeners() {
      if (typeof window === 'undefined') return;

      try {
        const autoSync = () => {
          const s = this.getSettings();
          if (s.autoSync && s.gasUrl && !this.isSyncing && navigator.onLine !== false) {
            this.sync().catch(() => {});
          }
        };

        window.addEventListener('online', () => { this._updateStatus('idle'); autoSync(); });
        window.addEventListener('offline', () => this._updateStatus('offline'));
        window.addEventListener('focus', autoSync);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') autoSync();
        });

        // Periodic sync every 20 seconds (HTTP only)
        if (window.location?.protocol?.startsWith('http')) {
          setInterval(autoSync, 20000);
        }

        // Manual sync & test connection buttons
        document.addEventListener('click', async e => {
          const btnSync = e.target.closest('#btn-manual-sync');
          if (btnSync) {
            e.preventDefault();
            window.Toast?.show('🔄 Đang đồng bộ với SQLite Cloud...', 'info', 2000);
            btnSync.disabled = true;
            const orig = btnSync.textContent;
            btnSync.textContent = '⏳ Đang đồng bộ...';
            try {
              const res = await this.sync();
              window.Toast?.show(
                res.success ? '✅ Đồng bộ thành công!' : '⚠️ Không thể đồng bộ. Kiểm tra mạng.',
                res.success ? 'success' : 'warning',
                3000
              );
            } catch (err) {
              window.Toast?.show('❌ Lỗi đồng bộ: ' + err.message, 'error', 4000);
            } finally {
              btnSync.disabled = false;
              btnSync.textContent = orig;
            }
            return;
          }

          const btnTest = e.target.closest('#btn-test-connection');
          if (btnTest) {
            e.preventDefault();
            window.Toast?.show('🧪 Đang kiểm tra kết nối...', 'info', 2000);
            btnTest.disabled = true;
            const orig = btnTest.textContent;
            btnTest.textContent = '⏳ Đang kiểm tra...';
            try {
              const ok = await this.testConnection(this.getSettings().gasUrl);
              window.Toast?.show(
                ok ? '✅ Kết nối SQLite Cloud thành công!' : '❌ Kết nối thất bại.',
                ok ? 'success' : 'error',
                3000
              );
            } catch (err) {
              window.Toast?.show('❌ Lỗi kết nối: ' + err.message, 'error', 4000);
            } finally {
              btnTest.disabled = false;
              btnTest.textContent = orig;
            }
          }
        });
      } catch (_) {}
    }
  }

  const engine = new SyncEngine();
  global.SyncEngine = engine;

  if (typeof globalThis !== 'undefined') globalThis.SyncEngine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
})(typeof window !== 'undefined' ? window : this);
