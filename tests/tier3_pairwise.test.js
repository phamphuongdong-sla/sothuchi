/**
 * tier3_pairwise.test.js - Tier 3: Cross-Feature Pairwise Interactions (11 Test Cases)
 * Tests interactions between module pairs (P1 to P11)
 * Evaluates actual application code loaded into VM sandbox context.
 */

const fs = require('fs');
const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runTier3Tests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  // P1: F3 x F4 (Data Model x Entry Form)
  results.push(await runTestCase('P1', 'P1: Entry Form submission creates DB record with pending_add status (F3 x F4)', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.DB, 'DB module must be loaded');
    const tx = env.context.DB.addTransaction({
      amount: 250000,
      type: 'expense',
      category: 'Ăn uống',
      date: '2026-08-10',
      note: 'Phở bò 2 tô'
    });
    TestAssert.isOk(tx.id);
    TestAssert.equal(tx.amount, 250000);
    TestAssert.equal(tx.sync_status, 'pending_add');
  }));

  // P2: F4 x F5 (Entry Form x Category System)
  results.push(await runTestCase('P2', 'P2: Adding custom category updates transaction entry form dropdown (F4 x F5)', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.CategoryManager, 'CategoryManager module must be loaded');
    const customCat = env.context.CategoryManager.addCategory({ name: 'Thú cưng', type: 'expense', icon: '🐶' });
    const activeCats = env.context.CategoryManager.getCategories(false);
    TestAssert.isTrue(activeCats.some(c => c.name === 'Thú cưng'));
    
    const tx = env.context.DB.addTransaction({ amount: 120000, category: customCat.name });
    TestAssert.equal(tx.category, 'Thú cưng');
  }));

  // P3: F4 x F6 (Entry Form x History List)
  results.push(await runTestCase('P3', 'P3: Adding transaction immediately updates history list grouping (F4 x F6)', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.HistoryManager, 'HistoryManager module must be loaded');
    env.context.DB.addTransaction({ date: '2026-08-10', amount: 100000, type: 'expense', category: 'Ăn uống' });
    env.context.DB.addTransaction({ date: '2026-08-10', amount: 300000, type: 'income', category: 'Lương' });
    const allTxs = env.context.DB.getTransactions();
    const groups = env.context.HistoryManager.groupTransactionsByDate(allTxs);
    TestAssert.equal(groups.length, 1);
    TestAssert.equal(groups[0].totalExpense, 100000);
    TestAssert.equal(groups[0].totalIncome, 300000);
  }));

  // P4: F4 x F7 (Entry Form x Reports)
  results.push(await runTestCase('P4', 'P4: Adding expense updates Chart.js dataset & net balance summary (F4 x F7)', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.ChartManager, 'ChartManager module must be loaded');
    env.context.DB.addTransaction({ amount: 1000000, type: 'income' });
    env.context.DB.addTransaction({ amount: 400000, type: 'expense', category: 'Mua sắm' });
    const summary = env.context.ChartManager.calculateSummary(env.context.DB.getTransactions());
    TestAssert.equal(summary.netBalance, 600000);
    const chartData = env.context.ChartManager.prepareCategoryChartData(env.context.DB.getTransactions());
    TestAssert.equal(chartData.total, 400000);
  }));

  // P5: F3 x F10 (Data Model x Sync Engine)
  results.push(await runTestCase('P5', 'P5: DB updates mark items pending_update & enqueue for sync (F3 x F10)', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    const tx = env.context.DB.addTransaction({ amount: 50000, category: 'Đi lại' });
    env.context.DB.updateTransaction(tx.id, { sync_status: 'synced' });
    
    env.context.DB.updateTransaction(tx.id, { amount: 70000 });
    const pending = env.context.DB.getTransactions().filter(t => t.sync_status !== 'synced');
    TestAssert.equal(pending.length, 1);
    TestAssert.equal(pending[0].sync_status, 'pending_update');
  }));

  // P6: F8 x F10 (Settings x Sync Engine)
  results.push(await runTestCase('P6', 'P6: Saving valid GAS URL in Settings triggers initial 2-way sync (F8 x F10)', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    env.context.SyncEngine.saveSettings({ gasUrl: env.gasServer.endpointUrl, autoSync: true });
    env.gasServer.sheetRows = [{ id: 'tx_sheet_1', date: '2026-08-10', amount: 500000, type: 'income', sync_status: 'synced' }];
    
    const pullRes = await env.context.SyncEngine.pullSync();
    TestAssert.isTrue(pullRes.success);
    const localTxs = env.context.DB.getTransactions();
    TestAssert.equal(localTxs.length, 1);
    TestAssert.equal(localTxs[0].amount, 500000);
  }));

  // P7: F2 x F10 (Service Worker x Sync Engine)
  results.push(await runTestCase('P7', 'P7: Offline transition queues txs; online reconnection drains queue (F2 x F10)', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    env.context.SyncEngine.saveSettings({ gasUrl: env.gasServer.endpointUrl, autoSync: true });
    
    // Offline
    env.window.navigator.onLine = false;
    env.context.DB.addTransaction({ amount: 95000, category: 'Giải trí' });
    TestAssert.equal(env.context.DB.getTransactions()[0].sync_status, 'pending_add');
    
    // Online restored
    env.window.navigator.onLine = true;
    const pushRes = await env.context.SyncEngine.pushSync();
    TestAssert.isTrue(pushRes.success);
    TestAssert.equal(env.context.DB.getTransactions()[0].sync_status, 'synced');
  }));

  // P8: F5 x F6 (Category System x History List)
  results.push(await runTestCase('P8', 'P8: Hiding category excludes from filters while retaining past history (F5 x F6)', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.CategoryManager, 'CategoryManager module must be loaded');
    const customCat = env.context.CategoryManager.addCategory({ name: 'Sách vở', type: 'expense' });
    env.context.DB.addTransaction({ amount: 150000, category: 'Sách vở' });
    
    env.context.CategoryManager.hideCategory(customCat.id);
    const activeCats = env.context.CategoryManager.getCategories(false);
    TestAssert.isFalse(activeCats.some(c => c.id === customCat.id));
    
    const pastHistory = env.context.HistoryManager.filterTransactions({ category: 'Sách vở' });
    TestAssert.equal(pastHistory.length, 1);
  }));

  // P9: F6 x F7 (History List x Reports)
  results.push(await runTestCase('P9', 'P9: History date filter range synchronously updates report metrics (F6 x F7)', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.ChartManager, 'ChartManager module must be loaded');
    env.context.DB.addTransaction({ date: '2026-07-10', amount: 500000, type: 'expense' });
    env.context.DB.addTransaction({ date: '2026-08-10', amount: 200000, type: 'expense' });
    
    const augTxs = env.context.HistoryManager.filterTransactions({ startDate: '2026-08-01', endDate: '2026-08-31' });
    const summary = env.context.ChartManager.calculateSummary(augTxs);
    TestAssert.equal(summary.totalExpense, 200000);
  }));

  // P10: F8 x F9 (Settings x GAS Backend)
  results.push(await runTestCase('P10', 'P10: Settings ping request matches expected Code.gs response contract (F8 x F9)', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    const isValid = await env.context.SyncEngine.testConnection(env.gasServer.endpointUrl);
    TestAssert.isTrue(isValid);
  }));

  // P11: F9 x F10 (GAS Backend x Sync Engine)
  results.push(await runTestCase('P11', 'P11: Code.gs syncBatch ACK updates local DB sync states to synced (F9 x F10)', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    env.context.SyncEngine.saveSettings({ gasUrl: env.gasServer.endpointUrl, autoSync: true });
    env.context.DB.addTransaction({ amount: 100000 });
    env.context.DB.addTransaction({ amount: 200000 });
    
    const pushRes = await env.context.SyncEngine.pushSync();
    TestAssert.isTrue(pushRes.success);
    TestAssert.equal(pushRes.syncedCount, 2);
    
    const localTxs = env.context.DB.getTransactions();
    TestAssert.isTrue(localTxs.every(t => t.sync_status === 'synced'));
  }));

  return results;
}

module.exports = { runTier3Tests };
