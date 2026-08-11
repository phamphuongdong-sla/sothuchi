/**
 * tests/deletion_sync.test.js - Bidirectional Deletion & 2-Way Sync Integration Tests
 */

const { TestEnvironment, TestAssert, runTestCase } = require('./test-utils');

async function runDeletionSyncTests(projectRoot) {
  const results = [];

  // Test 1: Local Deletion Push Sync
  results.push(await runTestCase('DEL-SYNC-1', 'Web App deletion marks pending_delete and pushSync sends delete command to GAS endpoint', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const { DB, SyncEngine, window } = env.context;

    DB.saveTransactions([]);
    DB.addTransaction({ id: 'tx_del_001', amount: 50000, category: 'Ăn uống', note: 'Phở sáng', sync_status: 'synced' });

    const activeBefore = DB.getTransactions({ includeDeleted: false });
    TestAssert.isTrue(activeBefore.some(t => t.id === 'tx_del_001'), 'Initial transaction missing');

    const deleted = DB.deleteTransaction('tx_del_001');
    TestAssert.isTrue(deleted, 'deleteTransaction returned false');

    const activeAfter = DB.getTransactions({ includeDeleted: false });
    TestAssert.isFalse(activeAfter.some(t => t.id === 'tx_del_001'), 'Transaction still present in active list after deletion');

    const allStored = DB.getTransactions({ includeDeleted: true });
    const target = allStored.find(t => t.id === 'tx_del_001');
    TestAssert.isOk(target, 'Transaction not found in raw stored items');
    TestAssert.equal(target.sync_status, 'pending_delete', 'Transaction status was not marked as pending_delete');

    window.fetch = async (url) => {
      return {
        ok: true,
        json: async () => ({
          status: 'success',
          synced_ids: ['tx_del_001']
        })
      };
    };

    const res = await SyncEngine.pushSync();
    TestAssert.isTrue(res.success, 'pushSync failed: ' + (res.error || res.reason));

    const postSyncAll = DB.getTransactions({ includeDeleted: true });
    TestAssert.isFalse(postSyncAll.some(t => t.id === 'tx_del_001'), 'Transaction was not permanently purged from LocalStorage after pushSync ACK');
  }));

  // Test 2: Remote Deletion Pull Sync
  results.push(await runTestCase('DEL-SYNC-2', 'Google Sheets remote deletion purges previously synced local transaction on pullSync', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const { DB, SyncEngine, window } = env.context;

    DB.saveTransactions([
      { id: 'tx_keep_101', date: '2026-08-11', type: 'expense', category: 'Ăn uống', amount: 30000, sync_status: 'synced' },
      { id: 'tx_remote_del_102', date: '2026-08-11', type: 'expense', category: 'Giải trí', amount: 100000, sync_status: 'synced' }
    ]);

    window.fetch = async (url) => {
      return {
        ok: true,
        json: async () => ({
          status: 'success',
          transactions: [
            { id: 'tx_keep_101', date: '2026-08-11', type: 'expense', category: 'Ăn uống', amount: 30000, created_at: '2026-08-11T00:00:00Z', updated_at: '2026-08-11T00:00:00Z' }
          ],
          categories: []
        })
      };
    };

    const res = await SyncEngine.pullSync();
    TestAssert.isTrue(res.success, 'pullSync failed: ' + (res.error || res.reason));

    const localAfterPull = DB.getTransactions({ includeDeleted: true });
    const existsKeep = localAfterPull.some(t => t.id === 'tx_keep_101');
    const existsDeleted = localAfterPull.some(t => t.id === 'tx_remote_del_102');

    TestAssert.isTrue(existsKeep, 'Active remote transaction was incorrectly removed');
    TestAssert.isFalse(existsDeleted, 'Transaction deleted on Google Sheets was NOT purged from Web App LocalStorage!');
  }));

  // Test 3: Full 2-Way Sync (push & pull combined)
  results.push(await runTestCase('DEL-SYNC-3', 'syncAll handles combined push deletion and pull remote deletion in sequence', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const { DB, SyncEngine, window } = env.context;

    DB.saveTransactions([
      { id: 'tx_local_del_201', date: '2026-08-11', type: 'expense', category: 'Cá nhân', amount: 45000, sync_status: 'pending_delete' },
      { id: 'tx_remote_del_202', date: '2026-08-11', type: 'expense', category: 'Sức khỏe', amount: 200000, sync_status: 'synced' }
    ]);

    window.fetch = async (url) => {
      if (url.includes('action=syncBatch') || url.includes('syncBatch')) {
        return {
          ok: true,
          json: async () => ({ status: 'success', synced_ids: ['tx_local_del_201'] })
        };
      }
      if (url.includes('action=fetchAll')) {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            transactions: [
              { id: 'tx_new_remote_203', date: '2026-08-11', type: 'income', category: 'Lương', amount: 15000000, created_at: '2026-08-11T00:00:00Z', updated_at: '2026-08-11T00:00:00Z' }
            ]
          })
        };
      }
      return { ok: false };
    };

    const res = await SyncEngine.syncAll();
    TestAssert.isTrue(res.success, 'syncAll failed');

    const finalDB = DB.getTransactions({ includeDeleted: true });
    TestAssert.isFalse(finalDB.some(t => t.id === 'tx_local_del_201'), 'Push-deleted item tx_local_del_201 was not purged');
    TestAssert.isFalse(finalDB.some(t => t.id === 'tx_remote_del_202'), 'Pull-deleted item tx_remote_del_202 was not purged');
    TestAssert.isTrue(finalDB.some(t => t.id === 'tx_new_remote_203'), 'New remote item tx_new_remote_203 was not pulled into local DB');
  }));

  return results;
}

module.exports = { runDeletionSyncTests };
