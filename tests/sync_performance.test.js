/**
 * tests/sync_performance.test.js - Data Sync Performance & Benchmark Integration Tests
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TestEnvironment, TestAssert, runTestCase } = require('./test-utils');

async function runSyncPerformanceTests(projectRoot) {
  const results = [];

  // Test 1: Code.gs Batch Sync Performance & Memory Map Operations
  results.push(await runTestCase('SYNC-PERF-1', 'Code.gs processSyncBatch executes in-memory batching without row-by-row API loops', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Load Code.gs backend script into VM sandbox context
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    const codeGsContent = fs.readFileSync(codeGsPath, 'utf8');
    vm.runInContext(codeGsContent, env.context);

    const { processSyncBatch } = env.context;
    TestAssert.isOk(typeof processSyncBatch === 'function', 'processSyncBatch function not found in Code.gs');

    // Create 100 transactions to push
    const batchTxs = [];
    for (let i = 0; i < 100; i++) {
      batchTxs.push({
        id: `tx_perf_${i}`,
        date: '2026-08-11',
        type: i % 2 === 0 ? 'expense' : 'income',
        category: 'Ăn uống',
        amount: (i + 1) * 10000,
        note: `Test performance item ${i}`,
        sync_status: 'pending_add'
      });
    }

    const startTime = Date.now();
    // Execute Code.gs processSyncBatch batch processor
    const response = processSyncBatch(batchTxs);
    const duration = Date.now() - startTime;

    TestAssert.equal(response.status, 'success', 'Batch sync failed in Code.gs');
    TestAssert.equal(response.synced_ids.length, 100, 'Not all 100 transaction IDs were returned as synced');
    TestAssert.isTrue(duration < 200, `Batch processing took too long: ${duration}ms (expected < 200ms)`);
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
