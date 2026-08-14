/**
 * tests/challenger_m1_stress.test.js
 * Empirical Challenger Stress Test Suite for Milestone 1:
 * - Cloudflare D1 Batch Chunking (0, 1, 79, 80, 81, 160, 250 statements)
 * - All-Entity Deletions & Zombie Resurrection Prevention
 * - Service Worker Offline Precaching & API Bypass
 * - Network Offline/Online State Transitions & Fault Handling
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('================================================================');
console.log(' EMPIRICAL CHALLENGER M1 STRESS TEST & AUDIT SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function stressTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
  }
}

(async () => {

  // ==========================================================================
  // SECTION 1: CLOUDFLARE D1 BATCH STATEMENT CHUNKING
  // ==========================================================================
  console.log('--- SECTION 1: Cloudflare D1 Batch Statement Chunking ---');

  // Load worker.js into context or import executeBatchSafe
  let workerModule;
  try {
    workerModule = await import('../worker.js');
  } catch (e) {
    const workerCode = fs.readFileSync(path.join(PROJECT_ROOT, 'worker.js'), 'utf8');
    const sandbox = { module: {}, exports: {}, console };
    vm.createContext(sandbox);
    const cjsCode = workerCode.replace(/export async function/g, 'async function')
                              .replace(/export default/g, 'const defaultExport = ') +
                    '\nmodule.exports = { executeBatchSafe, defaultExport };';
    vm.runInContext(cjsCode, sandbox);
    workerModule = sandbox.module.exports;
  }

  const { executeBatchSafe } = workerModule;

  // 1.1: 0 statements
  await stressTest('1.1: executeBatchSafe with 0 statements performs 0 db.batch calls', async () => {
    let callCount = 0;
    const mockDb = {
      batch: async (stmts) => { callCount++; }
    };
    await executeBatchSafe(mockDb, [], 80);
    assert.strictEqual(callCount, 0, 'Should not call db.batch for empty array');
  });

  // 1.2: 1 statement
  await stressTest('1.2: executeBatchSafe with 1 statement performs 1 db.batch call with 1 item', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    await executeBatchSafe(mockDb, [{ id: 1 }], 80);
    assert.strictEqual(batches.length, 1, 'Should call db.batch exactly once');
    assert.strictEqual(batches[0].length, 1, 'Batch should contain 1 item');
  });

  // 1.3: 79 statements (boundary just below 80)
  await stressTest('1.3: executeBatchSafe with 79 statements performs 1 db.batch call with 79 items', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    const stmts = Array.from({ length: 79 }, (_, i) => ({ id: i }));
    await executeBatchSafe(mockDb, stmts, 80);
    assert.strictEqual(batches.length, 1, 'Should call db.batch exactly once');
    assert.strictEqual(batches[0].length, 79, 'Batch should contain 79 items');
  });

  // 1.4: 80 statements (exact chunk limit boundary)
  await stressTest('1.4: executeBatchSafe with 80 statements performs 1 db.batch call with 80 items', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    const stmts = Array.from({ length: 80 }, (_, i) => ({ id: i }));
    await executeBatchSafe(mockDb, stmts, 80);
    assert.strictEqual(batches.length, 1, 'Should call db.batch exactly once');
    assert.strictEqual(batches[0].length, 80, 'Batch should contain 80 items');
  });

  // 1.5: 81 statements (boundary just above 80)
  await stressTest('1.5: executeBatchSafe with 81 statements performs 2 db.batch calls (80 + 1 items)', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    const stmts = Array.from({ length: 81 }, (_, i) => ({ id: i }));
    await executeBatchSafe(mockDb, stmts, 80);
    assert.strictEqual(batches.length, 2, 'Should call db.batch exactly 2 times');
    assert.strictEqual(batches[0].length, 80, '1st batch should contain 80 items');
    assert.strictEqual(batches[1].length, 1, '2nd batch should contain 1 item');
  });

  // 1.6: 160 statements (exact multiple of 80: 2 chunks of 80)
  await stressTest('1.6: executeBatchSafe with 160 statements performs exactly 2 db.batch calls of 80 items each', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    const stmts = Array.from({ length: 160 }, (_, i) => ({ id: i }));
    await executeBatchSafe(mockDb, stmts, 80);
    assert.strictEqual(batches.length, 2, 'Should call db.batch exactly 2 times');
    assert.strictEqual(batches[0].length, 80, 'Batch 1 length must be 80');
    assert.strictEqual(batches[1].length, 80, 'Batch 2 length must be 80');
  });

  // 1.7: 250 statements (heavy stress batch: 80 + 80 + 80 + 10)
  await stressTest('1.7: executeBatchSafe with 250 statements performs 4 db.batch calls (80 + 80 + 80 + 10 items)', async () => {
    const batches = [];
    const mockDb = {
      batch: async (stmts) => { batches.push(stmts); }
    };
    const stmts = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    await executeBatchSafe(mockDb, stmts, 80);
    assert.strictEqual(batches.length, 4, 'Should call db.batch exactly 4 times (250 / 80 = 4 chunks)');
    assert.strictEqual(batches[0].length, 80, 'Chunk 1 length must be 80');
    assert.strictEqual(batches[1].length, 80, 'Chunk 2 length must be 80');
    assert.strictEqual(batches[2].length, 80, 'Chunk 3 length must be 80');
    assert.strictEqual(batches[3].length, 10, 'Chunk 4 length must be 10');
    
    // Verify statement integrity and ordering
    const allBatchedIds = batches.flat().map(s => s.id);
    assert.strictEqual(allBatchedIds.length, 250, 'Total batched items must be 250');
    assert.deepStrictEqual(allBatchedIds, Array.from({ length: 250 }, (_, i) => i), 'Statement order must be preserved');
  });

  // 1.8: Worker syncBatch end-to-end with 250 mixed entities
  await stressTest('1.8: worker.js fetch handler chunks 250 mixed incoming entities into <=80 queries per batch', async () => {
    const batchesExecuted = [];
    const preparedSqls = [];

    const mockDb = {
      prepare: (sql) => ({
        bind: (...params) => {
          const bound = { sql, params };
          preparedSqls.push(bound);
          return bound;
        },
        all: async () => ({ results: [] }),
        first: async () => ({ count: 0 })
      }),
      batch: async (stmts) => {
        batchesExecuted.push([...stmts]);
      }
    };

    const env = { DB: mockDb };
    const defaultExport = workerModule.defaultExport || workerModule.default;

    // Generate 250 entities across all 7 types
    const body = {
      transactions: Array.from({ length: 50 }, (_, i) => ({ id: `tx_${i}`, date: '2026-08-14', type: 'expense', category: 'Ăn uống', amount: 50000 })),
      wallets: Array.from({ length: 30 }, (_, i) => ({ id: `w_${i}`, name: `Wallet ${i}`, balance: 1000000 })),
      categories: Array.from({ length: 40 }, (_, i) => ({ id: `cat_${i}`, name: `Cat ${i}`, type: 'expense' })),
      assets: Array.from({ length: 30 }, (_, i) => ({ id: `ast_${i}`, name: `Asset ${i}`, value: 5000000 })),
      liabilities: Array.from({ length: 30 }, (_, i) => ({ id: `lia_${i}`, name: `Liability ${i}`, total_debt: 2000000 })),
      loans: Array.from({ length: 30 }, (_, i) => ({ id: `loan_${i}`, person_name: `Person ${i}`, original_amount: 1000000 })),
      recurring: Array.from({ length: 20 }, (_, i) => ({ id: `rec_${i}`, category: 'Tiền nhà', amount: 3000000 })),
      audit_logs: Array.from({ length: 20 }, (_, i) => ({ id: `log_${i}`, action: 'create', entity_type: 'transaction' }))
    }; // Total = 50 + 30 + 40 + 30 + 30 + 30 + 20 + 20 = 250 items

    const request = {
      method: 'POST',
      url: 'https://sothuchi-backend.workers.dev/api/syncBatch',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => body
    };

    const response = await defaultExport.fetch(request, env, {});
    assert.strictEqual(response.status, 200, 'Response status must be 200 OK');

    const resJson = JSON.parse(await response.text());
    assert.strictEqual(resJson.status, 'success', 'Response status must be success');
    assert.strictEqual(resJson.synced_count, 250, 'Synced count must equal 250');

    assert.strictEqual(batchesExecuted.length, 4, 'Should execute 4 D1 batches for 250 statements');
    batchesExecuted.forEach((batch, idx) => {
      assert.ok(batch.length <= 80, `Batch ${idx} length (${batch.length}) must not exceed 80 statements limit`);
    });
  });

  // ==========================================================================
  // SECTION 2: ALL-ENTITY DELETION & ZOMBIE RESURRECTION
  // ==========================================================================
  console.log('\n--- SECTION 2: All-Entity Deletion & Zombie Resurrection Prevention ---');

  // 2.1: Non-Transaction Deletions in worker.js
  await stressTest('2.1: worker.js generates correct DELETE SQL statements for all 7 entity types', async () => {
    const executedDeletes = [];

    const mockDb = {
      prepare: (sql) => ({
        bind: (...params) => ({ sql, params }),
        all: async () => ({ results: [] })
      }),
      batch: async (stmts) => {
        stmts.forEach(s => {
          if (s.sql && s.sql.includes('DELETE FROM')) {
            executedDeletes.push(s);
          }
        });
      }
    };

    const env = { DB: mockDb };
    const defaultExport = workerModule.defaultExport || workerModule.default;

    const body = {
      transactions: [{ id: 'tx_del_1', sync_status: 'pending_delete' }],
      wallets: [{ id: 'w_del_1', is_deleted: true }],
      categories: [{ id: 'cat_del_1', action: 'delete' }],
      assets: [{ id: 'ast_del_1', sync_status: 'pending_delete' }],
      liabilities: [{ id: 'lia_del_1', is_deleted: 1 }],
      loans: [{ id: 'loan_del_1', action: 'delete' }],
      recurring: [{ id: 'rec_del_1', sync_status: 'pending_delete' }]
    };

    const request = {
      method: 'POST',
      url: 'https://sothuchi-backend.workers.dev/api/syncBatch',
      headers: new Map(),
      json: async () => body
    };

    const response = await defaultExport.fetch(request, env, {});
    assert.strictEqual(response.status, 200);

    const tablesDeleted = executedDeletes.map(d => {
      const match = d.sql.match(/DELETE FROM (\w+)/);
      return match ? match[1] : null;
    });

    const expectedTables = ['transactions', 'wallets', 'categories', 'assets', 'liabilities', 'loans', 'recurring'];
    expectedTables.forEach(table => {
      assert.ok(tablesDeleted.includes(table), `DELETE statement missing for table ${table}`);
    });
  });

  // Load sync.js into a sandboxed environment for client sync tests
  const syncJsCode = fs.readFileSync(path.join(PROJECT_ROOT, 'js/sync.js'), 'utf8');

  function createSyncContext() {
    const storage = new Map();
    const listeners = {};
    const dispatchedEvents = [];

    const mockDB = {
      _data: {
        transactions: [],
        wallets: [],
        assets: [],
        liabilities: [],
        loans: [],
        recurring: [],
        auditLogs: []
      },
      getTransactions: (opts = {}) => {
        if (opts.includeDeleted) return [...mockDB._data.transactions];
        return mockDB._data.transactions.filter(t => t.sync_status !== 'pending_delete');
      },
      saveTransactions: (txs, opts = {}) => {
        mockDB._data.transactions = [...txs];
      },
      getWallets: (includeHidden) => [...mockDB._data.wallets],
      saveWallets: (wallets) => { mockDB._data.wallets = [...wallets]; },
      getAssets: () => [...mockDB._data.assets],
      getLiabilities: () => [...mockDB._data.liabilities],
      getLoans: () => [...mockDB._data.loans],
      getRecurring: () => [...mockDB._data.recurring],
      getAuditLogs: () => [...mockDB._data.auditLogs],
      _setItem: (key, val) => {
        storage.set(key, val);
        if (key === 'stc_assets') mockDB._data.assets = JSON.parse(val);
        if (key === 'stc_liabilities') mockDB._data.liabilities = JSON.parse(val);
        if (key === 'stc_loans') mockDB._data.loans = JSON.parse(val);
        if (key === 'stc_recurring') mockDB._data.recurring = JSON.parse(val);
      }
    };

    const mockCategoryManager = {
      categories: [],
      mergeRemoteCategories: (remote) => {
        mockCategoryManager.categories = [...remote];
      }
    };

    const mockLocalStorage = {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear()
    };

    const mockWindow = {
      localStorage: mockLocalStorage,
      addEventListener: (type, fn) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      dispatchEvent: (evt) => {
        dispatchedEvents.push(evt);
      },
      DB: mockDB,
      CategoryManager: mockCategoryManager
    };

    const context = {
      window: mockWindow,
      document: {
        getElementById: () => null,
        addEventListener: () => {}
      },
      navigator: { onLine: true },
      localStorage: mockLocalStorage,
      DB: mockDB,
      CategoryManager: mockCategoryManager,
      CustomEvent: class {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      },
      console: console,
      setTimeout: (fn) => fn(),
      setInterval: () => {}
    };

    vm.createContext(context);
    vm.runInContext(syncJsCode, context);

    return {
      SyncEngine: context.SyncEngine,
      DB: mockDB,
      CategoryManager: mockCategoryManager,
      window: mockWindow,
      dispatchedEvents
    };
  }

  // 2.2: Zombie Resurrection Prevention in pullSync()
  await stressTest('2.2: pullSync purges locally synced transactions when missing from remote without resurrecting them as pending_add', async () => {
    const { SyncEngine, DB, window } = createSyncContext();

    // Client has:
    // 1. tx_active (synced)
    // 2. tx_deleted_remotely (synced) -> remote no longer has this!
    // 3. tx_local_pending (pending_add) -> unpushed offline transaction
    DB.saveTransactions([
      { id: 'tx_active', amount: 50000, updated_at: '2026-08-14T00:00:00Z', sync_status: 'synced' },
      { id: 'tx_deleted_remotely', amount: 100000, updated_at: '2026-08-14T00:00:00Z', sync_status: 'synced' },
      { id: 'tx_local_pending', amount: 20000, updated_at: '2026-08-14T01:00:00Z', sync_status: 'pending_add' }
    ]);

    // Remote returns only tx_active and a new tx_remote_new
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        transactions: [
          { id: 'tx_active', amount: 50000, updated_at: '2026-08-14T00:00:00Z' },
          { id: 'tx_remote_new', amount: 300000, updated_at: '2026-08-14T02:00:00Z' }
        ]
      })
    });

    const res = await SyncEngine.pullSync();
    assert.strictEqual(res.success, true, 'pullSync should succeed: ' + JSON.stringify(res));

    const localTxs = DB.getTransactions({ includeDeleted: true });
    
    // tx_deleted_remotely must NOT be resurrected as pending_add; it must be completely purged!
    const zombie = localTxs.find(t => t.id === 'tx_deleted_remotely');
    assert.strictEqual(zombie, undefined, 'Zombie transaction tx_deleted_remotely must NOT exist in local storage');

    // tx_active and tx_remote_new must exist and be synced
    const active = localTxs.find(t => t.id === 'tx_active');
    assert.ok(active && active.sync_status === 'synced', 'tx_active must be retained as synced');

    const remoteNew = localTxs.find(t => t.id === 'tx_remote_new');
    assert.ok(remoteNew && remoteNew.sync_status === 'synced', 'tx_remote_new must be added as synced');

    // Unpushed local pending tx_local_pending must NOT be purged
    const localPending = localTxs.find(t => t.id === 'tx_local_pending');
    assert.ok(localPending && localPending.sync_status === 'pending_add', 'Unpushed offline tx_local_pending must be preserved');
  });

  // 2.3: LWW Timestamp Conflict Resolution
  await stressTest('2.3: pullSync Last-Write-Wins (LWW) resolution correctly compares updated_at timestamps', async () => {
    const { SyncEngine, DB, window } = createSyncContext();

    // Client has tx_1 with updated_at = 12:00, modified locally at 14:00 (pending_update)
    DB.saveTransactions([
      { id: 'tx_lww_newer_local', note: 'Local Newer Note', updated_at: '2026-08-14T14:00:00Z', sync_status: 'pending_update' },
      { id: 'tx_lww_older_local', note: 'Local Stale Note', updated_at: '2026-08-14T10:00:00Z', sync_status: 'synced' }
    ]);

    // Remote has tx_lww_newer_local with older remote timestamp 12:00, and tx_lww_older_local with newer remote timestamp 15:00
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        transactions: [
          { id: 'tx_lww_newer_local', note: 'Remote Stale Note', updated_at: '2026-08-14T12:00:00Z' },
          { id: 'tx_lww_older_local', note: 'Remote Fresh Note', updated_at: '2026-08-14T15:00:00Z' }
        ]
      })
    });

    const res = await SyncEngine.pullSync();
    assert.strictEqual(res.success, true);

    const finalTxs = DB.getTransactions({ includeDeleted: true });
    
    // tx_lww_newer_local should retain local changes because localTime (14:00) > remoteTime (12:00)
    const tx1 = finalTxs.find(t => t.id === 'tx_lww_newer_local');
    assert.strictEqual(tx1.note, 'Local Newer Note', 'Local newer edit must win over stale remote');

    // tx_lww_older_local should be updated by remote because remoteTime (15:00) > localTime (10:00)
    const tx2 = finalTxs.find(t => t.id === 'tx_lww_older_local');
    assert.strictEqual(tx2.note, 'Remote Fresh Note', 'Remote fresh edit must win over stale local');
  });

  // 2.4: Loan repayments_json parsing resilience
  await stressTest('2.4: pullSync parses valid, empty, or corrupt repayments_json without throwing exceptions', async () => {
    const { SyncEngine, DB, window } = createSyncContext();

    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        transactions: [],
        loans: [
          { id: 'loan_valid', person_name: 'Alice', repayments_json: '[{"amount":50000,"date":"2026-08-10"}]' },
          { id: 'loan_corrupt', person_name: 'Bob', repayments_json: '{malformed json' },
          { id: 'loan_null', person_name: 'Charlie', repayments_json: null, repayments: null },
          { id: 'loan_array', person_name: 'David', repayments: [{ amount: 100000 }] }
        ]
      })
    });

    const res = await SyncEngine.pullSync();
    assert.strictEqual(res.success, true);

    const loans = DB.getLoans();
    const l1 = loans.find(l => l.id === 'loan_valid');
    assert.ok(Array.isArray(l1.repayments) && l1.repayments.length === 1 && l1.repayments[0].amount === 50000, 'Valid repayments_json should parse to array');

    const l2 = loans.find(l => l.id === 'loan_corrupt');
    assert.ok(Array.isArray(l2.repayments) && l2.repayments.length === 0, 'Corrupted repayments_json must fallback to empty array');

    const l3 = loans.find(l => l.id === 'loan_null');
    assert.ok(Array.isArray(l3.repayments) && l3.repayments.length === 0, 'Null repayments must fallback to empty array');

    const l4 = loans.find(l => l.id === 'loan_array');
    assert.ok(Array.isArray(l4.repayments) && l4.repayments.length === 1, 'Array repayments must be preserved');
  });

  // 2.5: UI Reactive Custom Events on pullSync
  await stressTest('2.5: pullSync dispatches all required reactive custom events (walletschanged, assetschanged, loanschanged, transactionschanged)', async () => {
    const { SyncEngine, window, dispatchedEvents } = createSyncContext();

    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        transactions: [{ id: 'tx_evt_1', amount: 10000 }],
        wallets: [{ id: 'w_1', name: 'Cash' }],
        assets: [{ id: 'a_1', name: 'Savings' }],
        loans: [{ id: 'l_1', person_name: 'Tom' }]
      })
    });

    await SyncEngine.pullSync();

    const eventNames = dispatchedEvents.map(e => e.type);
    const requiredEvents = [
      'transactionschanged',
      'transactionupdated',
      'transactiondeleted',
      'walletschanged',
      'assetschanged',
      'loanschanged'
    ];

    requiredEvents.forEach(evt => {
      assert.ok(eventNames.includes(evt), `Missing custom event dispatch for ${evt}`);
    });
  });

  // 2.6: Server returns 0 records guard
  await stressTest('2.6: pullSync when server returns 0 items does not wipe local un-synced data, schedules pushSync', async () => {
    const { SyncEngine, DB, window } = createSyncContext();

    DB.saveTransactions([
      { id: 'tx_existing_1', amount: 50000, sync_status: 'synced' }
    ]);

    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        transactions: []
      })
    });

    const res = await SyncEngine.pullSync();
    assert.strictEqual(res.success, true);

    const txs = DB.getTransactions({ includeDeleted: true });
    assert.strictEqual(txs.length, 1, 'Local records must not be wiped out when server returns 0');
    assert.strictEqual(txs[0].sync_status, 'pending_add', 'Local items marked pending_add to recover server data');
  });

  // ==========================================================================
  // SECTION 3: SERVICE WORKER PRECACHE & API BYPASS
  // ==========================================================================
  console.log('\n--- SECTION 3: Service Worker Precache & API Bypass ---');

  const swCode = fs.readFileSync(path.join(PROJECT_ROOT, 'sw.js'), 'utf8');

  function createSWEnvironment() {
    const eventListeners = {};
    const cacheStore = new Map();

    class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || 'OK';
        this.headers = init.headers || {};
      }
      clone() {
        return new MockResponse(this.body, { status: this.status, statusText: this.statusText, headers: { ...this.headers } });
      }
    }

    class MockRequest {
      constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || 'GET';
        this.mode = init.mode || 'cors';
      }
    }

    class MockCache {
      async addAll(urls) {
        for (const u of urls) {
          cacheStore.set(u, new MockResponse(`content_of_${u}`));
        }
      }
      async match(req) {
        const urlStr = typeof req === 'string' ? req : req.url;
        return cacheStore.get(urlStr) || null;
      }
      async put(req, resp) {
        const urlStr = typeof req === 'string' ? req : req.url;
        cacheStore.set(urlStr, resp);
      }
    }

    const mockCaches = {
      open: async () => new MockCache(),
      match: async (req) => {
        const urlStr = typeof req === 'string' ? req : req.url;
        return cacheStore.get(urlStr) || null;
      },
      keys: async () => ['so-thu-chi-v2', 'so-thu-chi-v1'],
      delete: async () => true
    };

    let fetchHandler = async (req) => {
      const urlStr = typeof req === 'string' ? req : req.url;
      return new MockResponse(`network_${urlStr}`);
    };

    const mockSelf = {
      addEventListener: (type, fn) => {
        eventListeners[type] = fn;
      },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    };

    const sandbox = {
      self: mockSelf,
      addEventListener: mockSelf.addEventListener.bind(mockSelf),
      caches: mockCaches,
      fetch: (req) => fetchHandler(req),
      Request: MockRequest,
      Response: MockResponse,
      URL: URL,
      console: console
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    async function simulateFetch(urlStr, options = {}) {
      let respondWithPromise = null;
      let responded = false;

      const event = {
        request: new MockRequest(urlStr, options),
        respondWith: (promise) => {
          responded = true;
          respondWithPromise = promise;
        }
      };

      eventListeners['fetch'](event);
      if (!responded) return { bypassed: true, response: null };
      const response = await respondWithPromise;
      return { bypassed: false, response };
    }

    return {
      eventListeners,
      cacheStore,
      simulateFetch,
      setFetchHandler: (fn) => { fetchHandler = fn; }
    };
  }

  // 3.1: Precache asset list coverage
  await stressTest('3.1: sw.js PRECACHE_ASSETS contains all 10 core web files and 6 app icons', async () => {
    const { eventListeners, cacheStore } = createSWEnvironment();
    let waitUntilPromise = null;
    eventListeners['install']({ waitUntil: (p) => { waitUntilPromise = p; } });
    await waitUntilPromise;

    const requiredAssets = [
      './',
      './index.html',
      './style.css',
      './app.js',
      './js/db.js',
      './js/sync.js',
      './js/categories.js',
      './js/history.js',
      './js/charts.js',
      './js/auth.js',
      './manifest.json',
      './icons/logo.svg',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './icons/icon-maskable-192.png',
      './icons/icon-maskable-512.png'
    ];

    requiredAssets.forEach(asset => {
      assert.ok(cacheStore.has(asset), `Precache is missing essential asset: ${asset}`);
    });
  });

  // 3.2: API request bypasses SW caching
  await stressTest('3.2: Cloudflare Workers (*.workers.dev) and /api/* endpoints strictly bypass Service Worker caching', async () => {
    const { simulateFetch } = createSWEnvironment();

    // 1. Cloudflare worker backend GET endpoint
    const res1 = await simulateFetch('https://sothuchi-sqlite-backend.mrdong-sothuchi.workers.dev/api/fetchAll');
    assert.strictEqual(res1.bypassed, true, 'Workers.dev URL must bypass SW cache');

    // 2. Relative or local /api/ endpoint
    const res2 = await simulateFetch('https://sothuchi.pages.dev/api/syncBatch');
    assert.strictEqual(res2.bypassed, true, '/api/ pathname must bypass SW cache');

    // 3. POST sync requests
    const res3 = await simulateFetch('https://sothuchi-sqlite-backend.mrdong-sothuchi.workers.dev', { method: 'POST' });
    assert.strictEqual(res3.bypassed, true, 'POST requests must bypass SW cache');
  });

  // 3.3: Offline navigation fallback
  await stressTest('3.3: Offline navigation requests successfully fallback to precached index.html', async () => {
    const { eventListeners, simulateFetch, setFetchHandler } = createSWEnvironment();
    let waitUntilPromise = null;
    eventListeners['install']({ waitUntil: (p) => { waitUntilPromise = p; } });
    await waitUntilPromise;

    // Simulate network offline exception
    setFetchHandler(async () => { throw new Error('Offline (Network connection lost)'); });

    const navRes = await simulateFetch('https://sothuchi.pages.dev/deep-route', { mode: 'navigate' });
    assert.strictEqual(navRes.bypassed, false, 'Navigation request must be handled by SW');
    assert.ok(navRes.response.body.includes('./index.html'), 'Offline navigation must return cached index.html');
  });

  // 3.4: Stale-While-Revalidate and Offline Fallback for App Shell JS/CSS
  await stressTest('3.4: Service worker serves cached local modules and stylesheets when network is unreachable', async () => {
    const { eventListeners, simulateFetch, setFetchHandler, cacheStore } = createSWEnvironment();
    let waitUntilPromise = null;
    eventListeners['install']({ waitUntil: (p) => { waitUntilPromise = p; } });
    await waitUntilPromise;

    // Put mock cached module
    cacheStore.set('https://sothuchi.pages.dev/js/sync.js', { body: 'cached_sync_js_module' });
    setFetchHandler(async () => { throw new Error('Offline'); });

    const moduleRes = await simulateFetch('https://sothuchi.pages.dev/js/sync.js');
    assert.strictEqual(moduleRes.bypassed, false, 'Module request intercepted by SW');
    assert.strictEqual(moduleRes.response.body, 'cached_sync_js_module', 'Cached module served during network outage');
  });

  // ==========================================================================
  // SUMMARY REPORT
  // ==========================================================================
  console.log('\n================================================================');
  console.log(` EMPIRICAL CHALLENGER M1 RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error(`\n❌ CHALLENGE FAILED: ${failedTests} test(s) failed:`);
    failures.forEach(f => console.error(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\n✅ ALL M1 STRESS TESTS PASSED EMPIRICALLY (VERDICT: APPROVE)');
  }
})();
