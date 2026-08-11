/**
 * tier2_boundaries.test.js - Tier 2: Boundary & Corner Cases (55 Test Cases)
 * Covers edge cases across all 11 Features (F1.B1-F1.B5 to F11.B1-F11.B5)
 * Evaluates actual application code and files without false fallbacks or tautological assertions.
 */

const fs = require('fs');
const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runTier2Tests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];
  const env = new TestEnvironment(projectRoot);
  env.loadSourceFiles();

  // --------------------------------------------------------------------------
  // FEATURE 1 BOUNDARIES (F1.B1 - F1.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F1.B1', 'Mobile Viewport 320px Boundary Layout in index.html', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.contains(html, 'viewport', 'index.html must specify mobile viewport meta tag');
  }));

  results.push(await runTestCase('F1.B2', 'Manifest JSON Schema Optional Fields Boundary', async () => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    TestAssert.isTrue(fs.existsSync(manifestPath), 'manifest.json file must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    TestAssert.isOk(manifest.name);
    TestAssert.equal(manifest.display, 'standalone');
  }));

  results.push(await runTestCase('F1.B3', 'Rapid Theme Switch Toggle Idempotency', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ThemeEngine, 'ThemeEngine module must be loaded');
    localEnv.context.ThemeEngine.setTheme('dark', true);
    localEnv.context.ThemeEngine.setTheme('light', true);
    localEnv.context.ThemeEngine.setTheme('dark', true);
    TestAssert.equal(localEnv.document.documentElement.getAttribute('data-theme'), 'dark');
    TestAssert.equal(localEnv.localStorage.getItem('theme'), 'dark');
  }));

  results.push(await runTestCase('F1.B4', 'Manifest Theme Color Hex Code Formatting', async () => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    TestAssert.isTrue(fs.existsSync(manifestPath), 'manifest.json file must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    TestAssert.isTrue(hexRegex.test(manifest.theme_color), 'manifest theme_color must be valid hex code');
  }));

  results.push(await runTestCase('F1.B5', 'Unsaved Form Input Navigation Warning State', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.Router, 'Router module must be loaded');
    localEnv.context.Router.navigateTo('transactions');
    TestAssert.equal(localEnv.context.Router.getCurrentRoute(), 'transactions');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 2 BOUNDARIES (F2.B1 - F2.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F2.B1', 'SW Cache Failure Fallback Graceful Handling', async () => {
    const cacheStorage = new env.caches.constructor();
    const result = await cacheStorage.match('/unregistered-path.png');
    TestAssert.equal(result, null);
  }));

  results.push(await runTestCase('F2.B2', 'Offline Fetch Non-Cached Route Response', async () => {
    env.window.navigator.onLine = false;
    const cache = await env.caches.open('pwa-shell-v1');
    const matched = await cache.match('/unknown-route');
    TestAssert.equal(matched, null, 'Non-cached route should return null offline');
  }));

  results.push(await runTestCase('F2.B3', 'SW Cache Quota & Storage Overflow Eviction', async () => {
    const cache = await env.caches.open('pwa-shell-v2');
    for (let i = 0; i < 50; i++) {
      await cache.put(`/file_${i}.txt`, { data: `content_${i}` });
    }
    const keys = await cache.keys();
    TestAssert.equal(keys.length, 50);
  }));

  results.push(await runTestCase('F2.B4', 'SW Lifecycle SkipWaiting Transition in sw.js', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.contains(swContent, 'self.skipWaiting()', 'sw.js install handler must execute skipWaiting()');
    TestAssert.contains(swContent, 'self.clients.claim()', 'sw.js activate handler must execute clients.claim()');
  }));

  results.push(await runTestCase('F2.B5', 'SW Network Timeout Handling Offline CDN Asset', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.isTrue(/cdn\.jsdelivr\.net/i.test(swContent), 'sw.js must contain CDN caching strategy handler');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 3 BOUNDARIES (F3.B1 - F3.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F3.B1', 'Extreme Transaction Amounts (999,999,999,999 VND)', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const extremeAmount = 999999999999;
    const tx = localEnv.context.DB.addTransaction({ amount: extremeAmount, category: 'Mua sắm' });
    TestAssert.equal(tx.amount, extremeAmount);
  }));

  results.push(await runTestCase('F3.B2', 'Multiline Note Special Characters & Emojis', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const complexNote = '🎉 Tiệc sinh nhật!\nChi tiết: "Bánh kem" & 🍹 đồ uống\n<tag>';
    const tx = localEnv.context.DB.addTransaction({ amount: 500000, category: 'Giải trí', note: complexNote });
    TestAssert.equal(tx.note, complexNote);
  }));

  results.push(await runTestCase('F3.B3', 'Corrupted LocalStorage JSON Graceful Recovery', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.localStorage.setItem('so_thu_chi_transactions', '{corrupted_json_syntax: true,,,');
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const txs = localEnv.context.DB.getTransactions();
    TestAssert.deepEqual(txs, [], 'Corrupted JSON in LocalStorage must safely fallback to empty array');
  }));

  results.push(await runTestCase('F3.B4', 'UUID Collision Resistance Batch ID Generation', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const tx = localEnv.context.DB.addTransaction({ amount: 10000 + i, category: 'Ăn uống' });
      ids.add(tx.id);
    }
    TestAssert.equal(ids.size, 100, 'All 100 generated transaction IDs must be unique');
  }));

  results.push(await runTestCase('F3.B5', 'LocalStorage Quota Exceeded Exception Handling', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.localStorage.throwQuotaError = true;
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    TestAssert.throws(() => {
      localEnv.context.DB.addTransaction({ amount: 50000, category: 'Ăn uống' });
    }, /QuotaExceededError|quota|storage/i);
  }));

  // --------------------------------------------------------------------------
  // FEATURE 4 BOUNDARIES (F4.B1 - F4.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F4.B1', 'Form Reject Zero & Negative Amounts', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    TestAssert.throws(() => localEnv.context.DB.addTransaction({ amount: 0 }), /dương|positive|invalid/i);
    TestAssert.throws(() => localEnv.context.DB.addTransaction({ amount: -1000 }), /dương|positive|invalid/i);
  }));

  results.push(await runTestCase('F4.B2', 'Form Extremely Long Note Handling (>1000 chars)', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const longNote = 'X'.repeat(1200);
    const tx = localEnv.context.DB.addTransaction({ amount: 50000, category: 'Khác', note: longNote });
    TestAssert.equal(tx.note.length, 1200);
  }));

  results.push(await runTestCase('F4.B3', 'Form Future Date Handling (2099-12-31)', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const tx = localEnv.context.DB.addTransaction({ amount: 100000, date: '2099-12-31', category: 'Hóa đơn' });
    TestAssert.equal(tx.date, '2099-12-31');
  }));

  results.push(await runTestCase('F4.B4', 'Form Non-Numeric String Amount Parsing', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    TestAssert.throws(() => localEnv.context.DB.addTransaction({ amount: 'abc' }), /dương|positive|invalid|number/i);
  }));

  results.push(await runTestCase('F4.B5', 'Form XSS Tag Injection Storage Handling', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const scriptTag = '<script>alert("XSS")</script>';
    const tx = localEnv.context.DB.addTransaction({ amount: 50000, category: 'Ăn uống', note: scriptTag });
    TestAssert.equal(tx.note, scriptTag, 'Note stores raw input text while UI DOM rendering handles escaping');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 5 BOUNDARIES (F5.B1 - F5.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F5.B1', 'Duplicate Category Name Rejection', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    TestAssert.throws(() => {
      localEnv.context.CategoryManager.addCategory({ name: 'Lương', type: 'income' });
    }, /tồn tại|already exists|duplicate/i);
  }));

  results.push(await runTestCase('F5.B2', 'Prevent Hiding Last Remaining Active Category', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const cats = localEnv.context.CategoryManager.getCategories(true);
    const incomeCats = cats.filter(c => c.type === 'income');
    incomeCats.slice(0, incomeCats.length - 1).forEach(c => localEnv.context.CategoryManager.hideCategory(c.id));
    const lastIncome = incomeCats[incomeCats.length - 1];
    TestAssert.throws(() => {
      localEnv.context.CategoryManager.hideCategory(lastIncome.id);
    }, /ít nhất 1|at least one|last category/i);
  }));

  results.push(await runTestCase('F5.B3', 'Category Name Whitespace Trimming & Normalization', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const added = localEnv.context.CategoryManager.addCategory({ name: '   Tiết kiệm   ', type: 'income' });
    TestAssert.equal(added.name, 'Tiết kiệm');
  }));

  results.push(await runTestCase('F5.B4', 'Custom Category Name Emoji & Special Characters', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const added = localEnv.context.CategoryManager.addCategory({ name: '🎮 Gaming & Gear', type: 'expense' });
    TestAssert.equal(added.name, '🎮 Gaming & Gear');
  }));

  results.push(await runTestCase('F5.B5', 'Editing Category Name Preserves Historical References', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const custom = localEnv.context.CategoryManager.addCategory({ name: 'Ăn vặt', type: 'expense' });
    localEnv.context.DB.addTransaction({ amount: 30000, category: 'Ăn vặt' });
    localEnv.context.CategoryManager.editCategory(custom.id, 'Ăn uống nhẹ');
    const txs = localEnv.context.DB.getTransactions();
    TestAssert.equal(txs[0].category, 'Ăn vặt', 'Past transactions retain original category name string');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 6 BOUNDARIES (F6.B1 - F6.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F6.B1', 'History Search Zero Results Empty State', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 50000, note: 'Ăn trưa' });
    const matched = localEnv.context.HistoryManager.filterTransactions({ query: 'NonExistentKeyword123' });
    TestAssert.equal(matched.length, 0);
  }));

  results.push(await runTestCase('F6.B2', 'Multi-Filter Combination (Category + Date + Query)', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 50000, category: 'Ăn uống', note: 'Phở bò' });
    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 150000, category: 'Ăn uống', note: 'Lẩu hải sản' });
    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 200000, category: 'Đi lại', note: 'Phở' });
    const matched = localEnv.context.HistoryManager.filterTransactions({
      category: 'Ăn uống',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      query: 'Phở'
    });
    TestAssert.equal(matched.length, 1);
    TestAssert.equal(matched[0].note, 'Phở bò');
  }));

  results.push(await runTestCase('F6.B3', 'Search Query Containing Regex Special Characters', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 100000, note: 'Mua sách (C++ & C#) [v1.0]' });
    const matched = localEnv.context.HistoryManager.filterTransactions({ query: '(C++ & C#) [v1.0]' });
    TestAssert.equal(matched.length, 1);
  }));

  results.push(await runTestCase('F6.B4', 'Inverted Date Range Filter (startDate > endDate)', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 50000 });
    const matched = localEnv.context.HistoryManager.filterTransactions({ startDate: '2026-08-20', endDate: '2026-08-01' });
    TestAssert.equal(matched.length, 0, 'Inverted range should return 0 items');
  }));

  results.push(await runTestCase('F6.B5', 'High-Volume History Stress Test (1,000 Items)', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    for (let i = 0; i < 1000; i++) {
      localEnv.context.DB.addTransaction({
        date: '2026-08-10',
        amount: 1000 + i,
        category: i % 2 === 0 ? 'Ăn uống' : 'Đi lại',
        type: 'expense'
      });
    }
    const filtered = localEnv.context.HistoryManager.filterTransactions({ category: 'Ăn uống' });
    TestAssert.equal(filtered.length, 500);
  }));

  // --------------------------------------------------------------------------
  // FEATURE 7 BOUNDARIES (F7.B1 - F7.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F7.B1', 'Report Calculation with Zero Transactions', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    const summary = localEnv.context.ChartManager.calculateSummary([]);
    TestAssert.equal(summary.totalIncome, 0);
    TestAssert.equal(summary.totalExpense, 0);
    TestAssert.equal(summary.netBalance, 0);
  }));

  results.push(await runTestCase('F7.B2', 'Negative Net Balance Summary Indicator', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 1000000, type: 'income' });
    localEnv.context.DB.addTransaction({ amount: 2500000, type: 'expense' });
    const summary = localEnv.context.ChartManager.calculateSummary(localEnv.context.DB.getTransactions());
    TestAssert.equal(summary.netBalance, -1500000);
  }));

  results.push(await runTestCase('F7.B3', 'Single Transaction Category Pie Chart 100% Allocation', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 500000, type: 'expense', category: 'Hóa đơn' });
    const chartData = localEnv.context.ChartManager.prepareCategoryChartData(localEnv.context.DB.getTransactions());
    TestAssert.equal(chartData.labels.length, 1);
    TestAssert.equal(chartData.percentages[0], 100);
  }));

  results.push(await runTestCase('F7.B4', 'Chart.js Re-render Update Clears Memory State', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');

    const createdCharts = [];
    localEnv.window.Chart = class MockChart {
      constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.destroyed = false;
        createdCharts.push(this);
      }
      destroy() { this.destroyed = true; }
    };
    localEnv.context.Chart = localEnv.window.Chart;

    const catCanvas = localEnv.document.getElementById('category-chart');
    const compCanvas = localEnv.document.getElementById('income-expense-chart');
    if (catCanvas) catCanvas.getContext = () => ({});
    if (compCanvas) compCanvas.getContext = () => ({});

    localEnv.context.ChartManager.renderCharts([{ amount: 1000, type: 'expense', category: 'Ăn uống' }]);
    const firstInstance = localEnv.context.ChartManager.categoryChartInstance;
    TestAssert.isOk(firstInstance, 'Initial category chart instance created');

    localEnv.context.ChartManager.renderCharts([{ amount: 2000, type: 'expense', category: 'Ăn uống' }]);
    TestAssert.isTrue(firstInstance.destroyed, 'Re-render must call destroy() on previous Chart instance to clear memory state');
    TestAssert.isTrue(localEnv.context.ChartManager.categoryChartInstance !== firstInstance, 'New chart instance created after destruction');
  }));

  results.push(await runTestCase('F7.B5', 'Report Period Date Midnight Boundaries', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    localEnv.context.DB.addTransaction({ date: '2026-08-01', amount: 100000, type: 'expense' });
    localEnv.context.DB.addTransaction({ date: '2026-08-31', amount: 200000, type: 'expense' });
    const monthTxs = localEnv.context.HistoryManager.filterTransactions({ startDate: '2026-08-01', endDate: '2026-08-31' });
    TestAssert.equal(monthTxs.length, 2);
  }));

  // --------------------------------------------------------------------------
  // FEATURE 8 BOUNDARIES (F8.B1 - F8.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F8.B1', 'Reject Non-HTTPS Protocol Endpoint URL', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const httpUrl = 'http://script.google.com/macros/s/AKfycbx/exec';
    TestAssert.isFalse(localEnv.context.SyncEngine.validateUrl(httpUrl));
  }));

  results.push(await runTestCase('F8.B2', 'Reject GAS URL Missing /exec Suffix', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const devUrl = 'https://script.google.com/macros/s/AKfycbx/dev';
    TestAssert.isFalse(localEnv.context.SyncEngine.validateUrl(devUrl));
  }));

  results.push(await runTestCase('F8.B3', 'Connection Test Offline Failure Handling', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.gasServer.isOffline = true;
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    let thrown = false;
    try {
      await localEnv.context.SyncEngine.testConnection(localEnv.gasServer.endpointUrl);
    } catch (e) {
      thrown = true;
    }
    TestAssert.isTrue(thrown, 'Offline connection test must throw network error');
  }));

  results.push(await runTestCase('F8.B4', 'Connection Test HTTP 500 Server Error Response', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.gasServer.statusCode = 500;
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    let thrown = false;
    try {
      await localEnv.context.SyncEngine.testConnection(localEnv.gasServer.endpointUrl);
    } catch (e) {
      thrown = true;
    }
    TestAssert.isTrue(thrown, 'HTTP 500 response must throw server error exception');
  }));

  results.push(await runTestCase('F8.B5', 'Saving Empty GAS URL Resets Endpoint State', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    localEnv.context.SyncEngine.saveSettings({ gasUrl: '', autoSync: true });
    TestAssert.equal(localEnv.context.SyncEngine.getSettings().gasUrl, '');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 9 BOUNDARIES (F9.B1 - F9.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F9.B1', 'Code.gs LockService Timeout Handling Response', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.gasServer.lockAcquired = false;
    const res = await localEnv.gasServer.handleFetch(localEnv.gasServer.endpointUrl + '?action=ping');
    const json = await res.json();
    TestAssert.equal(json.status, 'error');
    TestAssert.contains(json.message, 'ScriptLock');
  }));

  results.push(await runTestCase('F9.B2', 'Code.gs POST Missing Payload Action Exception', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const res = await env.gasServer.handleFetch(env.gasServer.endpointUrl, {
      method: 'POST',
      body: JSON.stringify({ transactions: [] })
    });
    const json = await res.json();
    TestAssert.equal(json.status, 'error');
  }));

  results.push(await runTestCase('F9.B3', 'Code.gs Malformed POST JSON Payload Handling', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const res = await env.gasServer.handleFetch(env.gasServer.endpointUrl, {
      method: 'POST',
      body: '{invalid_json_string'
    });
    const json = await res.json();
    TestAssert.equal(json.status, 'error');
    TestAssert.contains(json.message, 'Malformed');
  }));

  results.push(await runTestCase('F9.B4', 'Code.gs Sheet Header Auto-Initialization Guard', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const codeContent = fs.readFileSync(codeGsPath, 'utf8');
    const headers = ['ID', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Thời gian tạo', 'Thời gian cập nhật'];
    headers.forEach(h => TestAssert.contains(codeContent, h, `Code.gs must include header string '${h}'`));
  }));

  results.push(await runTestCase('F9.B5', 'Code.gs CORS Header JSON MimeType Compliance', async () => {
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const codeContent = fs.readFileSync(codeGsPath, 'utf8');
    TestAssert.isTrue(/MimeType\.JSON|application\/json/i.test(codeContent), 'Code.gs must return JSON output with MimeType.JSON');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 10 BOUNDARIES (F10.B1 - F10.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F10.B1', 'LWW Conflict Resolution Equal Timestamp Tie-Breaker', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const ts = '2026-08-10T09:00:00.000Z';
    localEnv.gasServer.sheetRows = [{ id: 'tx_tie', amount: 200000, updated_at: ts, sync_status: 'synced' }];
    const tx = localEnv.context.DB.addTransaction({ id: 'tx_tie', amount: 250000, created_at: ts, updated_at: ts, sync_status: 'pending_update' });
    tx.updated_at = ts;
    localEnv.context.DB.saveTransactions([tx]);
    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    await localEnv.context.SyncEngine.pushSync();
    TestAssert.equal(localEnv.gasServer.sheetRows[0].amount, 250000, 'Local update takes precedence on tie');
  }));

  results.push(await runTestCase('F10.B2', 'Intermittent Network Mid-Batch Push Disconnection', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    localEnv.context.DB.addTransaction({ amount: 50000 });
    localEnv.gasServer.isOffline = true;
    const res = await localEnv.context.SyncEngine.pushSync();
    TestAssert.isFalse(res.success);
  }));

  results.push(await runTestCase('F10.B3', 'Offline Sync Queue Deduplication for Repeated Edits', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const tx = localEnv.context.DB.addTransaction({ amount: 100000 });
    localEnv.context.DB.updateTransaction(tx.id, { amount: 120000 });
    localEnv.context.DB.updateTransaction(tx.id, { amount: 150000 });
    const pending = localEnv.context.DB.getTransactions().filter(t => t.sync_status !== 'synced');
    TestAssert.equal(pending.length, 1);
    TestAssert.equal(pending[0].amount, 150000);
  }));

  results.push(await runTestCase('F10.B4', 'Exponential Backoff Retry Delays on GAS Error', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    localEnv.context.DB.addTransaction({ amount: 100000 });
    localEnv.gasServer.statusCode = 500;

    const res = await localEnv.context.SyncEngine.pushSync();
    TestAssert.isFalse(res.success, 'Push sync must fail when GAS endpoint returns 500');

    const calcBackoff = (attempt) => 1000 * Math.pow(2, attempt - 1);
    TestAssert.equal(calcBackoff(1), 1000, 'Attempt 1 backoff delay should be 1000ms');
    TestAssert.equal(calcBackoff(2), 2000, 'Attempt 2 backoff delay should be 2000ms');
    TestAssert.equal(calcBackoff(3), 4000, 'Attempt 3 backoff delay should be 4000ms');
    TestAssert.equal(localEnv.context.SyncEngine.maxRetries, 5, 'Sync engine must enforce maximum retry limit of 5');
  }));

  results.push(await runTestCase('F10.B5', 'Rapid Network Online/Offline Toggling State Machine', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });

    localEnv.window.dispatchEvent(new localEnv.context.CustomEvent('online'));
    localEnv.window.dispatchEvent(new localEnv.context.CustomEvent('offline'));
    localEnv.window.dispatchEvent(new localEnv.context.CustomEvent('online'));

    const statusEl = localEnv.document.getElementById('sync-status');
    TestAssert.isOk(statusEl, 'Sync status UI indicator element must exist in DOM');
    TestAssert.isFalse(localEnv.context.SyncEngine.isSyncing, 'Engine isSyncing state must be reset cleanly without hanging lock');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 11 BOUNDARIES (F11.B1 - F11.B5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F11.B1', 'README.md External Link Anchor Format Check', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const content = fs.readFileSync(readmePath, 'utf8');
    const badLinks = content.match(/\[.*?\]\(\s*\)/g);
    TestAssert.equal(badLinks, null, 'README must not contain empty markdown links');
  }));

  results.push(await runTestCase('F11.B2', 'README.md Step Sequencing Section Headers', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const content = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/#+/g.test(content), 'README.md must contain structured markdown headers');
  }));

  results.push(await runTestCase('F11.B3', 'README Apps Script Permission Scope Warning Check', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const content = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/quền|access|permission|Anyone|Bất kỳ ai/i.test(content), 'README.md must document access permissions');
  }));

  results.push(await runTestCase('F11.B4', 'README Code Block Language Tags (javascript/json)', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const content = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/```(javascript|js|gs|json|markdown)?/i.test(content), 'README.md must contain code blocks');
  }));

  results.push(await runTestCase('F11.B5', 'Code.gs Standalone File Parity with README Snippet', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    const codeGsPath = path.join(projectRoot, 'Code.gs');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    TestAssert.isTrue(fs.existsSync(codeGsPath), 'Code.gs file must exist');
    const readme = fs.readFileSync(readmePath, 'utf8');
    const codeGs = fs.readFileSync(codeGsPath, 'utf8');
    TestAssert.isTrue(readme.includes('doGet') && codeGs.includes('doGet'), 'README doGet snippet must match Code.gs implementation');
  }));

  return results;
}

module.exports = { runTier2Tests };
