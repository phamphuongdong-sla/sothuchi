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
              gasUrl: parsed.gasUrl || DEFAULT_GAS_URL,
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

      const allTxs = db.getTransactions();
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
      try {
        const res = await fetchFn(settings.gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'syncBatch',
            transactions: payloadTransactions
          })
        });

        if (!res.ok) {
          throw new Error(`Push Sync HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.status === 'success') {
          const syncedIds = json.synced_ids || payloadTransactions.map(t => t.id);

          // Update local DB items to synced
          const updatedTxs = db.getTransactions().map(t => {
            if (syncedIds.includes(t.id)) {
              if (t.sync_status === 'pending_delete') {
                return null; // Permanently remove soft-deleted item after remote sync ACK
              }
              return { ...t, sync_status: 'synced' };
            }
            return t;
          }).filter(Boolean);

          db.saveTransactions(updatedTxs);
          this.isSyncing = false;
          this.retryCount = 0;
          this.updateStatusIndicator('success');
          return { success: true, syncedCount: syncedIds.length };
        } else {
          throw new Error(json.message || 'Push sync server error');
        }
      } catch (err) {
        this.isSyncing = false;
        this.updateStatusIndicator('error');
        return { success: false, error: err.message };
      }
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
          const localTxs = db.getTransactions();
          const localMap = new Map(localTxs.map(t => [t.id, t]));

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
                // Equal timestamp tie-breaker: Local update takes precedence on tie
                if (local.sync_status === 'synced') {
                  localMap.set(remote.id, { ...remote, sync_status: 'synced' });
                }
              }
            }
          });

          const mergedArray = Array.from(localMap.values());
          db.saveTransactions(mergedArray);

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
     * Update sync status bar indicator UI element in DOM
     * @param {string} state - 'idle', 'syncing', 'success', 'error', 'offline'
     */
    updateStatusIndicator(state) {
      if (!global.document) return;
      const el = global.document.getElementById('sync-status');
      if (!el) return;

      el.className = 'sync-status status-' + state;
      switch (state) {
        case 'syncing':
          el.textContent = '🔄 Đang đồng bộ...';
          break;
        case 'success':
          el.textContent = '✅ Đã đồng bộ';
          break;
        case 'error':
          el.textContent = '⚠️ Lỗi đồng bộ';
          break;
        case 'offline':
          el.textContent = '📡 Ngoại tuyến';
          break;
        default:
          el.textContent = '🌐 Sẵn sàng';
          break;
      }
    }

    /**
     * Register window network listeners for auto-sync
     */
    initListeners() {
      if (typeof window === 'undefined') return;

      window.addEventListener('online', () => {
        this.updateStatusIndicator('idle');
        const settings = this.getSettings();
        if (settings.autoSync && settings.gasUrl) {
          this.syncAll();
        }
      });

      window.addEventListener('offline', () => {
        this.updateStatusIndicator('offline');
      });
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
