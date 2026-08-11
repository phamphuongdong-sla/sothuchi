/**
 * js/sync.js - Google Sheets 2-Way Sync Engine & Offline Queue Manager
 * Manages Settings persistence, GAS endpoint validation, ping connection testing,
 * 2-way sync protocol (push/pull), Last-Write-Wins (LWW) conflict resolution,
 * and offline queue auto-sync trigger state machine.
 */

(function(global) {
  'use strict';

  class SyncEngine {
    constructor() {
      this.STORAGE_KEY = 'stc_settings';
      this.LEGACY_KEY = 'so_thu_chi_settings';
      this.isSyncing = false;
      this.hasPendingSyncRequest = false;
      this.retryCount = 0;
      this.maxRetries = 5;

      this.initListeners();
    }

    /**
     * Validate Google Apps Script Web App Endpoint URL
     * @param {string} url 
     * @returns {boolean} True if URL matches https://script.google.com/macros/s/.../exec
     */
    validateUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      if (!trimmed.startsWith('https://script.google.com/macros/s/')) return false;
      if (!trimmed.endsWith('/exec')) return false;
      return true;
    }

    /**
     * Save settings to LocalStorage
     * @param {Object} settings - { gasUrl, autoSync }
     */
    saveSettings(settings = {}) {
      const current = this.getSettings();
      const updated = {
        gasUrl: settings.gasUrl !== undefined ? settings.gasUrl.trim() : current.gasUrl,
        autoSync: settings.autoSync !== undefined ? Boolean(settings.autoSync) : current.autoSync
      };

      const storage = global.localStorage || (global.window && global.window.localStorage);
      if (storage) {
        try {
          storage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
          storage.setItem(this.LEGACY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('[SyncEngine] Failed to save settings to localStorage:', e);
        }
      }

      this.updateStatusIndicator('idle');
      return updated;
    }

    /**
     * Retrieve settings from LocalStorage
     * @returns {Object} { gasUrl, autoSync }
     */
    getSettings() {
      const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzI9y7gVMLLob2lNltvGyzH5_ZA-XEav5MC-037FI7JzuWS38iQ6dTzitphHBkhC5HiQQ/exec';
      const storage = global.localStorage || (global.window && global.window.localStorage);
      if (storage) {
        try {
          const data = storage.getItem(this.STORAGE_KEY) || storage.getItem(this.LEGACY_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            return {
              gasUrl: parsed.gasUrl !== undefined ? parsed.gasUrl : DEFAULT_GAS_URL,
              autoSync: parsed.autoSync !== undefined ? Boolean(parsed.autoSync) : true
            };
          }
        } catch (e) {
          console.error('[SyncEngine] Failed to parse settings JSON:', e);
        }
      }
      return { gasUrl: DEFAULT_GAS_URL, autoSync: true };
    }

    /**
     * Test connection to GAS Web App endpoint via action=ping
     * @param {string} url 
     * @returns {Promise<boolean>} True if ping succeeds
     */
    async testConnection(url) {
      const endpoint = url || this.getSettings().gasUrl;
      if (!this.validateUrl(endpoint)) {
        throw new Error('Đường dẫn GAS Web App Endpoint không hợp lệ');
      }

      const fetchFn = global.fetch || (global.window && global.window.fetch);
      if (!fetchFn) {
        throw new Error('Fetch API is not available');
      }

      const pingUrl = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=ping';
      const response = await fetchFn(pingUrl, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json.status === 'error') {
        throw new Error(json.message || 'Connection test failed');
      }

      return json.status === 'ok' || json.status === 'success';
    }

    /**
     * Push local pending transactions (pending_add, pending_update, pending_delete) to GAS backend
     * @returns {Promise<Object>} { success, syncedCount }
     */
    async pushSync() {
      if (this.isSyncing) {
        this.hasPendingSyncRequest = true;
        return { success: false, reason: 'Sync already in progress' };
      }

      const nav = global.navigator || (global.window && global.window.navigator);
      if (nav && nav.onLine === false) {
        this.updateStatusIndicator('offline');
        return { success: false, reason: 'Offline' };
      }

      const settings = this.getSettings();
      if (!settings.gasUrl || !this.validateUrl(settings.gasUrl)) {
        return { success: false, reason: 'Invalid or missing endpoint URL' };
      }

      const db = global.DB || (global.window && global.window.DB);
      if (!db) {
        return { success: false, reason: 'DB module not available' };
      }

      const allTxs = db.getTransactions({ includeDeleted: true });
      const pendingTxs = allTxs.filter(t => t.sync_status && t.sync_status !== 'synced');

      if (pendingTxs.length === 0) {
        this.updateStatusIndicator('success');
        return { success: true, syncedCount: 0 };
      }

      // Deduplicate pending items by ID for offline queue deduplication
      const deduplicatedMap = new Map();
      pendingTxs.forEach(t => deduplicatedMap.set(t.id, t));
      const payloadTransactions = Array.from(deduplicatedMap.values());

      this.isSyncing = true;
      this.updateStatusIndicator('syncing');

      const fetchFn = global.fetch || (global.window && global.window.fetch);
      const payloadObj = {
        action: 'syncBatch',
        transactions: payloadTransactions
      };

      const payloadStr = JSON.stringify(payloadObj);
      let successResult = null;

      // 1. Try GET syncBatch query parameter if payload is small (< 1000 chars)
      if (payloadStr.length < 1000) {
        try {
          const encodedPayload = encodeURIComponent(payloadStr);
          const syncGetUrl = settings.gasUrl + (settings.gasUrl.includes('?') ? '&' : '?') + 'action=syncBatch&payload=' + encodedPayload;
          const resGet = await fetchFn(syncGetUrl, { method: 'GET' });

          if (resGet.ok) {
            const jsonGet = await resGet.json();
            if (jsonGet.status === 'success') {
              successResult = jsonGet;
            }
          }
        } catch (getErr) {
          console.warn('[SyncEngine] GET syncBatch failed, trying POST fallback:', getErr);
        }
      }

      // 2. Direct POST method if payload > 1000 chars or GET failed
      if (!successResult) {
        try {
          const res = await fetchFn(settings.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payloadStr
          });

          if (!res.ok) {
            throw new Error(`Push Sync HTTP ${res.status}`);
          }

          const json = await res.json();
          if (json.status === 'success') {
            successResult = json;
          } else {
            throw new Error(json.message || 'Push sync server error');
          }
        } catch (err) {
          this.isSyncing = false;
          this.updateStatusIndicator('error');
          const isAuthError = err.message && (err.message.includes('SyntaxError') || err.message.includes('<') || err.message.includes('Unexpected token'));
          const friendlyMsg = isAuthError 
            ? 'Google Sheet chưa được Cấp Quyền ghi dữ liệu. Vui lòng mở Apps Script > chọn hàm doGet > bấm ▶ Chạy (Run) để Cấp Quyền!' 
            : err.message;
          return { success: false, error: friendlyMsg };
        }
      }

      const syncedIds = successResult.synced_ids || payloadTransactions.map(t => t.id);

      const updatedTxs = db.getTransactions({ includeDeleted: true }).map(t => {
        if (syncedIds.includes(t.id)) {
          if (t.sync_status === 'pending_delete') {
            return null;
          }
          return { ...t, sync_status: 'synced' };
        }
        return t;
      }).filter(Boolean);

      db.saveTransactions(updatedTxs, { skipAutoPush: true });
      this.isSyncing = false;
      this.retryCount = 0;
      this.updateStatusIndicator('success');

      // Drain queued sync request if user modified transactions during flight
      if (this.hasPendingSyncRequest) {
        this.hasPendingSyncRequest = false;
        setTimeout(() => this.pushSync().catch(() => {}), 50);
      }

      return { success: true, syncedCount: syncedIds.length };
    }

    /**
     * Pull remote transactions from GAS backend and merge into local DB using LWW
     * @returns {Promise<Object>} { success, pulledCount }
     */
    async pullSync() {
      const nav = global.navigator || (global.window && global.window.navigator);
      if (nav && nav.onLine === false) {
        this.updateStatusIndicator('offline');
        return { success: false, reason: 'Offline' };
      }

      const settings = this.getSettings();
      if (!settings.gasUrl || !this.validateUrl(settings.gasUrl)) {
        return { success: false, reason: 'Invalid or missing endpoint URL' };
      }

      const db = global.DB || (global.window && global.window.DB);
      if (!db) {
        return { success: false, reason: 'DB module not available' };
      }

      this.isSyncing = true;
      this.updateStatusIndicator('syncing');

      const fetchFn = global.fetch || (global.window && global.window.fetch);
      try {
        const pullUrl = settings.gasUrl + (settings.gasUrl.includes('?') ? '&' : '?') + 'action=fetchAll';
        const res = await fetchFn(pullUrl, { method: 'GET' });

        if (!res.ok) {
          throw new Error(`Pull Sync HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.transactions)) {
          const remoteTxs = json.transactions;
          const localTxs = db.getTransactions({ includeDeleted: true });
          const localMap = new Map(localTxs.map(t => [t.id, t]));
          const remoteIdSet = new Set(remoteTxs.map(r => String(r.id)));

          // 1. Process local synced or pending_delete items missing from remote (deleted on Sheets)
          localTxs.forEach(local => {
            if (local.sync_status === 'synced' && !remoteIdSet.has(String(local.id))) {
              localMap.delete(local.id);
            } else if (local.sync_status === 'pending_delete' && !remoteIdSet.has(String(local.id))) {
              localMap.delete(local.id);
            }
          });

          // 2. Merge remote items using Last-Write-Wins (LWW)
          remoteTxs.forEach(remote => {
            const local = localMap.get(remote.id);
            if (!local) {
              // New remote record
              localMap.set(remote.id, { ...remote, sync_status: 'synced' });
            } else {
              // LWW Conflict Resolution
              const remoteTime = new Date(remote.updated_at || remote.updatedAt || 0).getTime();
              const localTime = new Date(local.updated_at || local.updatedAt || 0).getTime();

              if (remoteTime > localTime) {
                // Remote is strictly newer
                localMap.set(remote.id, { ...remote, sync_status: 'synced' });
              } else if (remoteTime === localTime) {
                // Equal timestamp tie-breaker: Local update takes precedence on tie if synced
                if (local.sync_status === 'synced') {
                  localMap.set(remote.id, { ...remote, sync_status: 'synced' });
                }
              }
            }
          });

          const mergedArray = Array.from(localMap.values());
          db.saveTransactions(mergedArray, { skipAutoPush: true });

          // Dispatch reactive DOM events to immediately notify History, Dashboard & Charts UI components
          if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            try {
              window.dispatchEvent(new CustomEvent('transactionschanged', { detail: { transactions: mergedArray } }));
              window.dispatchEvent(new CustomEvent('transactionupdated'));
              window.dispatchEvent(new CustomEvent('transactiondeleted'));
            } catch (e) {}
          }

          // Update Categories if provided from sheet "DanhMuc"
          if (Array.isArray(json.categories) && json.categories.length > 0) {
            const catMgr = global.CategoryManager || (global.window && global.window.CategoryManager);
            if (catMgr && typeof catMgr.mergeRemoteCategories === 'function') {
              catMgr.mergeRemoteCategories(json.categories);
            }
          }

          this.isSyncing = false;
          this.updateStatusIndicator('success');
          return { success: true, pulledCount: remoteTxs.length };
        } else {
          throw new Error(json.message || 'Pull sync server error');
        }
      } catch (err) {
        this.isSyncing = false;
        this.updateStatusIndicator('error');
        return { success: false, error: err.message };
      }
    }

    /**
     * Full 2-way sync protocol (Push then Pull)
     * @returns {Promise<Object>}
     */
    async syncAll() {
      const pushRes = await this.pushSync();
      const pullRes = await this.pullSync();
      return {
        push: pushRes,
        pull: pullRes,
        success: (pushRes.success !== false) && (pullRes.success !== false)
      };
    }

    /**
     * Alias for syncAll()
     */
    async sync() {
      return await this.syncAll();
    }

    /**
     * Update sync status bar indicator UI element in DOM
     * @param {string} state - 'idle', 'syncing', 'success', 'error', 'offline'
     */
    updateStatusIndicator(state) {
      if (!global.document) return;
      const el = global.document.getElementById('sync-status');
      if (!el) return;

      el.className = 'sync-status status-' + state;

      const titleMap = {
        syncing: '🔄 Đang đồng bộ với Google Sheets...',
        success: '✅ Đã đồng bộ thành công',
        error: '⚠️ Lỗi đồng bộ',
        offline: '📡 Ngoại tuyến (Offline)',
        idle: '🌐 Sẵn sàng đồng bộ'
      };

      const textMap = {
        syncing: 'Đang đồng bộ...',
        success: 'Đã đồng bộ',
        error: 'Lỗi đồng bộ',
        offline: 'Ngoại tuyến',
        idle: 'Sẵn sàng'
      };

      el.setAttribute('title', titleMap[state] || 'Trạng thái đồng bộ');

      const textNode = el.querySelector('.status-text');
      if (textNode) {
        textNode.textContent = textMap[state] || 'Sẵn sàng';
      } else {
        el.innerHTML = `<span class="status-dot"></span><span class="status-text">${textMap[state] || 'Sẵn sàng'}</span>`;
      }
    }

    /**
     * Register window network listeners and click events for manual sync
     */
    initListeners() {
      if (typeof window === 'undefined') return;

      try {
        const handleAutoSyncTrigger = () => {
          const settings = this.getSettings();
          const nav = global.navigator || (typeof window !== 'undefined' ? window.navigator : null);
          if (settings.autoSync && settings.gasUrl && !this.isSyncing && nav && nav.onLine !== false) {
            this.syncAll().catch(() => {});
          }
        };

        if (typeof window.addEventListener === 'function') {
          window.addEventListener('online', () => {
            this.updateStatusIndicator('idle');
            handleAutoSyncTrigger();
          });

          window.addEventListener('offline', () => {
            this.updateStatusIndicator('offline');
          });

          // Auto-sync on window focus (user switches back to tab after editing/deleting on Sheets)
          window.addEventListener('focus', handleAutoSyncTrigger);
        }

        // Auto-sync on tab visibility change
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              handleAutoSyncTrigger();
            }
          });
        }

        // Background periodic auto-sync polling every 20 seconds (if in browser)
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
          try {
            const syncInterval = setInterval(handleAutoSyncTrigger, 20000);
            if (syncInterval && typeof syncInterval.unref === 'function') {
              syncInterval.unref();
            }
          } catch (e) {}
        }

        // Attach click handlers for manual sync and test buttons in Settings
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('click', async (e) => {
        const btnSync = e.target.closest('#btn-manual-sync');
        if (btnSync) {
          e.preventDefault();
          const toast = window.Toast;
          if (toast) toast.show('🔄 Đang đồng bộ với Google Sheets...', 'info', 2000);
          btnSync.disabled = true;
          const origText = btnSync.textContent;
          btnSync.textContent = '⏳ Đang đồng bộ...';

          try {
            const res = await this.syncAll();
            if (res.success) {
              if (toast) toast.show('✅ Đồng bộ thành công với Google Sheets!', 'success', 3000);
            } else {
              if (toast) toast.show('⚠️ Không thể đồng bộ. Vui lòng kiểm tra mạng hoặc kết nối.', 'warning', 4000);
            }
          } catch (err) {
            if (toast) toast.show('❌ Lỗi đồng bộ: ' + err.message, 'error', 4000);
          } finally {
            btnSync.disabled = false;
            btnSync.textContent = origText;
          }
        }

        const btnTest = e.target.closest('#btn-test-connection');
        if (btnTest) {
          e.preventDefault();
          const toast = window.Toast;
          if (toast) toast.show('🧪 Đang kiểm tra kết nối Google Sheets...', 'info', 2000);
          btnTest.disabled = true;
          const origText = btnTest.textContent;
          btnTest.textContent = '⏳ Đang kiểm tra...';

          try {
            const settings = this.getSettings();
            const isOk = await this.testConnection(settings.gasUrl);
            if (isOk) {
              if (toast) toast.show('✅ Kết nối Google Sheets thành công (HTTP OK)!', 'success', 3000);
            } else {
              if (toast) toast.show('❌ Kết nối thất bại. Vui lòng kiểm tra lại Google Sheet.', 'error', 4000);
            }
          } catch (err) {
            if (toast) toast.show('❌ Lỗi kết nối: ' + err.message, 'error', 4000);
          } finally {
            btnTest.disabled = false;
            btnTest.textContent = origText;
          }
        }
      });
    }
  } catch (err) {}
}
  }

  const engine = new SyncEngine();
  global.SyncEngine = engine;
  global.Sync = engine;
  if (typeof window !== 'undefined') {
    window.SyncEngine = engine;
    window.Sync = engine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.SyncEngine = engine;
    globalThis.Sync = engine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})(typeof window !== 'undefined' ? window : this);
