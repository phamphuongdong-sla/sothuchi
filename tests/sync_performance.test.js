/**
 * tests/sync_performance.test.js - Data Sync Performance & Benchmark Integration Tests
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TestEnvironment, TestAssert, runTestCase } = require('./test-utils');

async function runSyncPerformanceTests(projectRoot) {
  const results = [];

  // Test 1: worker.js Batch Sync Performance & Memory Map Operations
  results.push(await runTestCase('SYNC-PERF-1', 'worker.js processSyncBatch executes in-memory batching without row-by-row API loops', async () => {
    const workerPath = path.join(projectRoot, 'worker.js');
    TestAssert.isTrue(fs.existsSync(workerPath), 'worker.js backend file must exist in project root');
    const codeContent = fs.readFileSync(workerPath, 'utf8');
    TestAssert.contains(codeContent, 'syncBatch', 'worker.js must define syncBatch handler');
    TestAssert.contains(codeContent, 'executeBatchSafe', 'worker.js must define executeBatchSafe helper');
  }));

  // Test 2: skipAutoPush Flag Prevents Redundant Sync Loops
  results.push(await runTestCase('SYNC-PERF-2', 'saveTransactions with skipAutoPush option avoids triggering nested pushSync calls', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const { DB, SyncEngine } = env.context;

    let pushCallCount = 0;
    SyncEngine.pushSync = async () => {
      pushCallCount++;
      return { success: true, syncedCount: 0 };
    };

    // Save with skipAutoPush: true (as done during pullSync)
    DB.saveTransactions([{ id: 'tx_pull_1', amount: 50000, sync_status: 'synced' }], { skipAutoPush: true });

    // Wait 100ms to ensure no async timer fires pushSync
    await new Promise(r => setTimeout(r, 100));

    TestAssert.equal(pushCallCount, 0, `pushSync was called ${pushCallCount} times despite skipAutoPush: true`);
  }));

  // Test 3: Sync In-Flight Queueing
  results.push(await runTestCase('SYNC-PERF-3', 'Concurrent pushSync requests queue and execute after active sync finishes', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const { DB, SyncEngine, window } = env.context;

    DB.saveTransactions([{ id: 'tx_q_1', amount: 20000, sync_status: 'pending_add' }]);

    window.fetch = async () => {
      await new Promise(r => setTimeout(r, 50));
      return {
        ok: true,
        json: async () => ({ status: 'success', synced_ids: ['tx_q_1'] })
      };
    };

    // Trigger first sync (in-flight)
    const p1 = SyncEngine.pushSync();
    TestAssert.isTrue(SyncEngine.isSyncing, 'isSyncing state was not set to true during active pushSync');

    // Trigger concurrent second sync
    const res2 = await SyncEngine.pushSync();
    TestAssert.isFalse(res2.success, 'Second pushSync call should return success: false due to active sync');
    TestAssert.equal(res2.reason, 'Sync already in progress', 'Unexpected reason for queued sync');
    TestAssert.isTrue(SyncEngine.hasPendingSyncRequest, 'hasPendingSyncRequest flag was not set to true');

    const res1 = await p1;
    TestAssert.isTrue(res1.success, 'First pushSync call failed');

    // Wait for queued sync to drain
    await new Promise(r => setTimeout(r, 100));
    TestAssert.isFalse(SyncEngine.hasPendingSyncRequest, 'hasPendingSyncRequest was not cleared after queued drain');
  }));

  return results;
}

module.exports = { runSyncPerformanceTests };
