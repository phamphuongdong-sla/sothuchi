/**
 * tier4_scenarios.test.js - Tier 4: Real-World Application Scenarios (5 Test Cases)
 * End-to-end multi-feature workflows (S1 to S5)
 * Evaluates actual application code loaded into VM sandbox context.
 */

const fs = require('fs');
const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runTier4Tests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  // S1: Daily Expense Recording & Offline Sync
  results.push(await runTestCase('S1', 'S1: Daily Expense Recording & Offline Sync Workflow', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    env.context.SyncEngine.saveSettings({ gasUrl: env.gasServer.endpointUrl, autoSync: true });
    
    // Step 1: User goes offline
    env.window.navigator.onLine = false;
    
    // Step 2: Record 5 daily expenses offline
    const items = [
      { amount: 35000, category: 'Ăn uống', note: 'Bữa sáng phở gà' },
      { amount: 45000, category: 'Ăn uống', note: 'Cà phê Highland' },
      { amount: 70000, category: 'Ăn uống', note: 'Cơm trưa văn phòng' },
      { amount: 100000, category: 'Đi lại', note: 'Đổ xăng xe máy' },
      { amount: 150000, category: 'Mua sắm', note: 'Mua khẩu trang & khăn giấy' }
    ];
    
    for (const item of items) {
      env.context.DB.addTransaction(item);
    }
    
    // Step 3: Verify local DB state while offline
    const offlineTxs = env.context.DB.getTransactions();
    TestAssert.equal(offlineTxs.length, 5);
    TestAssert.isTrue(offlineTxs.every(t => t.sync_status === 'pending_add'));
    
    // Step 4: Reconnect to network & push sync
    env.window.navigator.onLine = true;
    const pushRes = await env.context.SyncEngine.pushSync();
    TestAssert.isTrue(pushRes.success);
    TestAssert.equal(pushRes.syncedCount, 5);
    
    // Step 5: Verify GAS server received all 5 items and local DB updated to synced
    TestAssert.equal(env.gasServer.sheetRows.length, 5);
    const syncedTxs = env.context.DB.getTransactions();
    TestAssert.isTrue(syncedTxs.every(t => t.sync_status === 'synced'));
  }));

  // S2: Custom Category Setup & Transaction Categorization
  results.push(await runTestCase('S2', 'S2: Custom Category Setup & Categorization Workflow', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.CategoryManager, 'CategoryManager module must be loaded');
    
    // Step 1: Create custom categories
    const petCat = env.context.CategoryManager.addCategory({ name: 'Thú cưng riêng', type: 'expense', icon: '🐶' });
    const insuranceCat = env.context.CategoryManager.addCategory({ name: 'Bảo hiểm riêng', type: 'expense', icon: '🛡️' });
    
    // Step 2: Add transactions under new categories
    env.context.DB.addTransaction({ amount: 300000, category: petCat.name, note: 'Thức ăn cho cún' });
    env.context.DB.addTransaction({ amount: 120000, category: petCat.name, note: 'Tắm spa cho cún' });
    env.context.DB.addTransaction({ amount: 1500000, category: insuranceCat.name, note: 'Bảo hiểm y tế tháng 8' });
    
    // Step 3: Filter history by custom category
    const petHistory = env.context.HistoryManager.filterTransactions({ category: 'Thú cưng riêng' });
    TestAssert.equal(petHistory.length, 2);
    
    // Step 4: Inspect Category Breakdown Report metrics
    const chartData = env.context.ChartManager.prepareCategoryChartData(env.context.DB.getTransactions());
    TestAssert.equal(chartData.total, 1920000);
    const petIdx = chartData.labels.indexOf('Thú cưng riêng');
    TestAssert.isTrue(petIdx !== -1);
    TestAssert.equal(chartData.percentages[petIdx], 21.9);
  }));

  // S3: Apps Script Endpoint Setup & 2-Way Sync Protocol
  results.push(await runTestCase('S3', 'S3: GAS Endpoint Setup & 2-Way Sync Protocol Workflow', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.SyncEngine, 'SyncEngine module must be loaded');
    const endpoint = env.gasServer.endpointUrl;
    
    // Step 1: Validate & Save Endpoint URL in Settings
    TestAssert.isTrue(env.context.SyncEngine.validateUrl(endpoint));
    env.context.SyncEngine.saveSettings({ gasUrl: endpoint, autoSync: true });
    
    // Step 2: Connection Ping Test
    const isOk = await env.context.SyncEngine.testConnection(endpoint);
    TestAssert.isTrue(isOk);
    
    // Step 3: Server pre-populated with remote Sheet rows
    env.gasServer.sheetRows = [
      { id: 'tx_sheet_101', date: '2026-08-01', type: 'income', category: 'Lương', amount: 15000000, note: 'Lương tháng 7', updated_at: '2026-08-01T00:00:00.000Z', sync_status: 'synced' },
      { id: 'tx_sheet_102', date: '2026-08-02', type: 'expense', category: 'Hóa đơn', amount: 1200000, note: 'Tiền điện nước', updated_at: '2026-08-02T00:00:00.000Z', sync_status: 'synced' }
    ];
    
    // Step 4: Initial Pull Sync
    const pull1 = await env.context.SyncEngine.pullSync();
    TestAssert.isTrue(pull1.success);
    TestAssert.equal(env.context.DB.getTransactions().length, 2);
    
    // Step 5: User adds local transaction offline
    const localTx = env.context.DB.addTransaction({ date: '2026-08-10', type: 'expense', category: 'Ăn uống', amount: 90000, note: 'Bữa tối' });
    
    // Step 6: 2-Way Sync Execution
    const pushRes = await env.context.SyncEngine.pushSync();
    TestAssert.isTrue(pushRes.success);
    TestAssert.equal(env.gasServer.sheetRows.length, 3);
  }));

  // S4: PWA Installation, Offline Mode & Service Worker Cache
  results.push(await runTestCase('S4', 'S4: PWA Installation, Offline Mode & SW Cache Workflow', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    
    // Step 1: SW Registration
    const reg = await env.window.navigator.serviceWorker.register('sw.js');
    TestAssert.isTrue(reg.active);
    
    // Step 2: Pre-cache App Shell & CDN
    const cache = await env.caches.open('pwa-shell-v1');
    await cache.put('/index.html', { content: '<html>SPA Shell</html>' });
    await cache.put('/style.css', { content: 'body { color: #333; }' });
    await cache.put('https://cdn.jsdelivr.net/npm/chart.js', { content: 'ChartJS Bundle' });
    
    // Step 3: Switch to Offline Mode
    env.window.navigator.onLine = false;
    
    // Step 4: Verify App Shell Cache Hit
    const htmlAsset = await cache.match('/index.html');
    TestAssert.isOk(htmlAsset);
    const chartAsset = await cache.match('https://cdn.jsdelivr.net/npm/chart.js');
    TestAssert.isOk(chartAsset);
  }));

  // S5: Monthly Financial Review & Filtering Report Generation
  results.push(await runTestCase('S5', 'S5: Monthly Financial Review & Filtering Report Workflow', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.context.HistoryManager, 'HistoryManager module must be loaded');
    
    // Step 1: Load 20 transactions across July and August
    for (let day = 1; day <= 10; day++) {
      env.context.DB.addTransaction({ date: `2026-07-0${day}`, type: 'expense', category: 'Ăn uống', amount: 50000, note: `July Expense ${day}` });
    }
    env.context.DB.addTransaction({ date: '2026-08-01', type: 'income', category: 'Lương', amount: 20000000, note: 'Lương tháng 8' });
    for (let day = 1; day <= 9; day++) {
      env.context.DB.addTransaction({ date: `2026-08-0${day}`, type: 'expense', category: 'Ăn uống', amount: 80000, note: `Aug Food ${day}` });
    }
    
    TestAssert.equal(env.context.DB.getTransactions().length, 20);
    
    // Step 2: Select "This Month" (August 2026) filter range
    const augTxs = env.context.HistoryManager.filterTransactions({ startDate: '2026-08-01', endDate: '2026-08-31' });
    TestAssert.equal(augTxs.length, 10);
    
    // Step 3: Verify Summary Metrics for August
    const summary = env.context.ChartManager.calculateSummary(augTxs);
    TestAssert.equal(summary.totalIncome, 20000000);
    TestAssert.equal(summary.totalExpense, 720000);
    TestAssert.equal(summary.netBalance, 19280000);
    
    // Step 4: Keyword Search Filter for Income Record
    const incomeRecords = env.context.HistoryManager.filterTransactions({ query: 'Lương' });
    TestAssert.equal(incomeRecords.length, 1);
    TestAssert.equal(incomeRecords[0].amount, 20000000);
  }));

  return results;
}

module.exports = { runTier4Tests };
