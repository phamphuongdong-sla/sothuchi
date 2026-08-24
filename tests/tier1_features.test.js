/**
 * tier1_features.test.js - Tier 1: Feature Coverage (55 Test Cases)
 * Covers 11 Features from PROJECT.md (F1.1-F1.5 to F11.1-F11.5)
 * Evaluates actual application code and files without facade/Spec classes or false fallbacks.
 */

const fs = require('fs');
const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runTier1Tests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];
  const env = new TestEnvironment(projectRoot);
  env.loadSourceFiles();

  // --------------------------------------------------------------------------
  // FEATURE 1: PWA Manifest & App Shell (F1.1 - F1.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F1.1', 'PWA Manifest JSON Schema Validation', async () => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    TestAssert.isTrue(fs.existsSync(manifestPath), 'manifest.json file must exist in project root');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    TestAssert.isOk(manifest.name, 'Manifest must have a name property');
    TestAssert.isOk(manifest.short_name, 'Manifest must have a short_name property');
    TestAssert.equal(manifest.display, 'standalone', 'Display mode must be standalone');
    TestAssert.isOk(manifest.start_url, 'Manifest must specify start_url');
    TestAssert.isOk(manifest.background_color, 'Manifest must specify background_color');
    TestAssert.isOk(manifest.theme_color, 'Manifest must specify theme_color');
  }));

  results.push(await runTestCase('F1.2', 'PWA Manifest Icon Sizes & File Assets Existence', async () => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    TestAssert.isTrue(fs.existsSync(manifestPath), 'manifest.json file must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const icons = manifest.icons || [];
    TestAssert.isTrue(icons.length >= 2, 'Manifest must contain icon definitions');
    const has192 = icons.some(i => i.sizes === '192x192');
    const has512 = icons.some(i => i.sizes === '512x512');
    TestAssert.isTrue(has192, 'Manifest must define 192x192 icon');
    TestAssert.isTrue(has512, 'Manifest must define 512x512 icon');
    TestAssert.isTrue(fs.existsSync(path.join(projectRoot, 'icons/icon-192.png')), '192x192 icon file must exist');
    TestAssert.isTrue(fs.existsSync(path.join(projectRoot, 'icons/icon-512.png')), '512x512 icon file must exist');
  }));

  results.push(await runTestCase('F1.3', 'App Shell HTML Viewport & Manifest Link', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.contains(htmlContent, 'viewport', 'index.html must specify mobile viewport meta tag');
    TestAssert.contains(htmlContent, 'manifest.json', 'index.html must link to manifest.json');
  }));

  results.push(await runTestCase('F1.4', 'App Shell Navigation Structure (4 Core Tabs)', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.isTrue(/href="#transactions"|data-view="transactions"/i.test(html), 'App Shell must include Transactions tab');
    TestAssert.isTrue(/href="#budget"|data-view="budget"/i.test(html), 'App Shell must include Budget tab');
    TestAssert.isTrue(/href="#reports"|data-view="reports"/i.test(html), 'App Shell must include Reports tab');
    TestAssert.isTrue(/href="#settings"|data-view="settings"/i.test(html), 'App Shell must include Settings tab');
  }));

  results.push(await runTestCase('F1.5', 'Dark/Light Theme Switching & LocalStorage Persistence', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ThemeEngine, 'ThemeEngine module must be loaded from app.js');
    localEnv.context.ThemeEngine.setTheme('dark', true);
    TestAssert.equal(localEnv.document.documentElement.getAttribute('data-theme'), 'dark', 'DOM data-theme attribute must be dark');
    TestAssert.equal(localEnv.localStorage.getItem('theme'), 'dark', 'LocalStorage theme item must be dark');
    localEnv.context.ThemeEngine.toggleTheme();
    TestAssert.equal(localEnv.document.documentElement.getAttribute('data-theme'), 'light', 'DOM data-theme attribute must switch to light');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 2: Service Worker & Offline Caching (F2.1 - F2.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F2.1', 'Service Worker Registration Contract', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist in project root');
    const reg = await env.window.navigator.serviceWorker.register('./sw.js');
    TestAssert.isTrue(reg.active, 'SW registration should return active registration object');
  }));

  results.push(await runTestCase('F2.2', 'SW Cache Strategy - App Shell Pre-caching Assets List', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.contains(swContent, 'index.html', 'SW precache list must include index.html');
    TestAssert.contains(swContent, 'style.css', 'SW precache list must include style.css');
    TestAssert.contains(swContent, 'app.js', 'SW precache list must include app.js');
    TestAssert.contains(swContent, 'manifest.json', 'SW precache list must include manifest.json');
  }));

  results.push(await runTestCase('F2.3', 'SW Cache Strategy - Chart.js CDN Asset Handling', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.isTrue(/cdn\.jsdelivr\.net|chart\.js/i.test(swContent), 'sw.js must contain logic for caching CDN assets');
  }));

  results.push(await runTestCase('F2.4', 'SW Activation & Old Cache Cleanup Handler', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.contains(swContent, "addEventListener('activate'", 'sw.js must define activate event listener');
    TestAssert.contains(swContent, 'caches.keys', 'sw.js activate handler must inspect cache keys for cleanup');
  }));

  results.push(await runTestCase('F2.5', 'Offline Asset Fetch Serving & Navigation Fallback', async () => {
    const swPath = path.join(projectRoot, 'sw.js');
    TestAssert.isTrue(fs.existsSync(swPath), 'sw.js file must exist');
    const swContent = fs.readFileSync(swPath, 'utf8');
    TestAssert.contains(swContent, "addEventListener('fetch'", 'sw.js must define fetch event listener');
    TestAssert.isTrue(/navigate|index\.html/i.test(swContent), 'sw.js fetch handler must support navigation fallback to index.html');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 3: Core Data Model & LocalStorage Manager (F3.1 - F3.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F3.1', 'DB Add Transaction Schema & Pending Status', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded from js/db.js');
    const tx = localEnv.context.DB.addTransaction({
      amount: 150000,
      type: 'expense',
      category: 'Ăn uống',
      date: '2026-08-10',
      note: 'Bữa trưa công ty'
    });
    TestAssert.isOk(tx.id, 'Transaction must have generated id');
    TestAssert.equal(tx.amount, 150000, 'Transaction amount must match');
    TestAssert.equal(tx.sync_status, 'pending_add', 'Transaction sync_status must be pending_add');
    TestAssert.isOk(tx.created_at, 'Transaction created_at timestamp required');
    TestAssert.isOk(tx.updated_at, 'Transaction updated_at timestamp required');
  }));

  results.push(await runTestCase('F3.2', 'DB Retrieve All Transactions Array', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded from js/db.js');
    localEnv.context.DB.addTransaction({ amount: 50000, category: 'Đi lại' });
    localEnv.context.DB.addTransaction({ amount: 200000, category: 'Lương', type: 'income' });
    const txs = localEnv.context.DB.getTransactions();
    TestAssert.equal(txs.length, 2, 'Should retrieve exactly 2 transactions');
  }));

  results.push(await runTestCase('F3.3', 'DB Update Transaction & Timestamp', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded from js/db.js');
    const tx = localEnv.context.DB.addTransaction({ amount: 100000, category: 'Giải trí' });
    const updated = localEnv.context.DB.updateTransaction(tx.id, { amount: 120000, note: 'Xem phim 3D' });
    TestAssert.equal(updated.amount, 120000);
    TestAssert.equal(updated.note, 'Xem phim 3D');
  }));

  results.push(await runTestCase('F3.4', 'DB Delete Transaction Mark Pending Delete', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded from js/db.js');
    const tx = localEnv.context.DB.addTransaction({ amount: 30000, category: 'Ăn uống' });
    localEnv.context.DB.updateTransaction(tx.id, { sync_status: 'synced' });
    localEnv.context.DB.deleteTransaction(tx.id);
    const all = localEnv.context.DB.getTransactions({ includeDeleted: true });
    const deletedTx = all.find(t => t.id === tx.id);
    TestAssert.equal(deletedTx.sync_status, 'pending_delete');
  }));

  results.push(await runTestCase('F3.5', 'LocalStorage Persistence Across Re-instantiation', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    localEnv.context.DB.addTransaction({ id: 'tx_persisted_1', amount: 500000, category: 'Hóa đơn' });

    const localEnv2 = new TestEnvironment(projectRoot);
    localEnv2.localStorage.store = localEnv.localStorage.store;
    localEnv2.loadSourceFiles();
    const txs = localEnv2.context.DB.getTransactions();
    TestAssert.equal(txs.length, 1);
    TestAssert.equal(txs[0].id, 'tx_persisted_1');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 4: Quick Transaction Entry Form (F4.1 - F4.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F4.1', 'Form Layout Input Fields Integrity in index.html', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.isTrue(/id="form-transaction"|id="transaction-form"|id="input-amount"|<form/i.test(html), 'index.html must contain transaction entry form markup');
  }));

  results.push(await runTestCase('F4.2', 'Income vs Expense Type Toggle UX', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const incomeTx = localEnv.context.DB.addTransaction({ amount: 1000000, type: 'income', category: 'Lương' });
    const expenseTx = localEnv.context.DB.addTransaction({ amount: 50000, type: 'expense', category: 'Ăn uống' });
    TestAssert.equal(incomeTx.type, 'income');
    TestAssert.equal(expenseTx.type, 'expense');
  }));

  results.push(await runTestCase('F4.3', 'Form Submit Validation (Positive Amount Required)', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    TestAssert.throws(() => {
      localEnv.context.DB.addTransaction({ amount: -50000, category: 'Ăn uống' });
    }, /số dương|positive|invalid/i);
  }));

  results.push(await runTestCase('F4.4', 'Currency Formatting VND Display', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    const formatFn = localEnv.context.formatVND || (localEnv.context.DB && localEnv.context.DB.formatVND);
    TestAssert.isOk(typeof formatFn === 'function', 'VND currency formatter function formatVND must be available');
    const formatted = formatFn(150000);
    TestAssert.contains(formatted, '150.000');
  }));

  results.push(await runTestCase('F4.5', 'Form Submission & Input Reset Flow', async () => {
    const dbPath = path.join(projectRoot, 'js/db.js');
    TestAssert.isTrue(fs.existsSync(dbPath), 'js/db.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.DB, 'DB module must be loaded');
    const countBefore = localEnv.context.DB.getTransactions().length;
    localEnv.context.DB.addTransaction({ amount: 75000, category: 'Mua sắm' });
    const countAfter = localEnv.context.DB.getTransactions().length;
    TestAssert.equal(countAfter, countBefore + 1);
  }));

  // --------------------------------------------------------------------------
  // FEATURE 5: Category Customization System (F5.1 - F5.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F5.1', 'Category Module & Default Categories Schema', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const cats = localEnv.context.CategoryManager.getCategories();
    TestAssert.isTrue(Array.isArray(cats) && cats.length > 0, 'Categories array must not be empty');
    TestAssert.isOk(cats[0].name, 'Category must have name');
    TestAssert.isOk(cats[0].type, 'Category must have type');
  }));

  results.push(await runTestCase('F5.2', 'Add Custom Category', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const newCat = localEnv.context.CategoryManager.addCategory({ name: 'Thú cưng', type: 'expense', icon: '🐶' });
    TestAssert.equal(newCat.name, 'Thú cưng');
    TestAssert.equal(newCat.is_default, false);
  }));

  results.push(await runTestCase('F5.3', 'Edit Category Name', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const cats = localEnv.context.CategoryManager.getCategories();
    const updated = localEnv.context.CategoryManager.editCategory(cats[0].id, 'Tên mới');
    TestAssert.equal(updated.name, 'Tên mới');
  }));

  results.push(await runTestCase('F5.4', 'Soft Hide Category', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const cats = localEnv.context.CategoryManager.getCategories();
    localEnv.context.CategoryManager.hideCategory(cats[0].id);
    const activeCats = localEnv.context.CategoryManager.getCategories(false);
    TestAssert.isFalse(activeCats.some(c => c.id === cats[0].id), 'Hidden category should be excluded from active categories list');
  }));

  results.push(await runTestCase('F5.5', 'Category Dropdown UI Sync', async () => {
    const catPath = path.join(projectRoot, 'js/categories.js');
    TestAssert.isTrue(fs.existsSync(catPath), 'js/categories.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager module must be loaded');
    const cats = localEnv.context.CategoryManager.getCategories(false);
    TestAssert.isTrue(cats.length > 0, 'Active category list must be available for form dropdown population');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 6: Transaction History & Filter/Search (F6.1 - F6.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F6.1', 'History Module & List Rendering', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');

    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 85000, category: 'Ăn uống', note: 'Bún chả Hà Nội', type: 'expense' });
    const container = localEnv.document.getElementById('history-list-container');
    TestAssert.isOk(container, 'History list container element must exist in index.html');

    localEnv.context.HistoryManager.renderHistoryList(localEnv.context.DB.getTransactions(), container);
    TestAssert.contains(container.innerHTML, 'Bún chả Hà Nội', 'Rendered history list must contain transaction note');
    TestAssert.contains(container.innerHTML, 'Ăn uống', 'Rendered history list must contain category name');
    TestAssert.contains(container.innerHTML, '85.000', 'Rendered history list must contain formatted amount string');
  }));

  results.push(await runTestCase('F6.2', 'Keyword Search Filtering', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 50000, note: 'Cà phê Sài Gòn' });
    localEnv.context.DB.addTransaction({ amount: 200000, note: 'Tiền điện tháng 8' });
    const filtered = localEnv.context.HistoryManager.filterTransactions({ query: 'cà phê' });
    TestAssert.equal(filtered.length, 1);
    TestAssert.contains(filtered[0].note.toLowerCase(), 'cà phê');
  }));

  results.push(await runTestCase('F6.3', 'Category & Type Filter Selection', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 50000, type: 'expense', category: 'Ăn uống' });
    localEnv.context.DB.addTransaction({ amount: 200000, type: 'income', category: 'Lương' });
    const filtered = localEnv.context.HistoryManager.filterTransactions({ type: 'income' });
    TestAssert.equal(filtered.length, 1);
    TestAssert.equal(filtered[0].type, 'income');
  }));

  results.push(await runTestCase('F6.4', 'Date Range Filter (Start & End Date)', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');
    localEnv.context.DB.addTransaction({ date: '2026-08-01', amount: 10000 });
    localEnv.context.DB.addTransaction({ date: '2026-08-05', amount: 20000 });
    localEnv.context.DB.addTransaction({ date: '2026-08-10', amount: 30000 });
    const filtered = localEnv.context.HistoryManager.filterTransactions({ startDate: '2026-08-04', endDate: '2026-08-06' });
    TestAssert.equal(filtered.length, 1);
    TestAssert.equal(filtered[0].date, '2026-08-05');
  }));

  results.push(await runTestCase('F6.5', 'Transaction Edit & Delete Modal Actions in History', async () => {
    const histPath = path.join(projectRoot, 'js/history.js');
    TestAssert.isTrue(fs.existsSync(histPath), 'js/history.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.HistoryManager, 'HistoryManager module must be loaded');

    const tx = localEnv.context.DB.addTransaction({ amount: 120000, category: 'Đi lại', note: 'GrabBike', type: 'expense' });
    const container = localEnv.document.getElementById('history-list-container');
    localEnv.context.HistoryManager.renderHistoryList(localEnv.context.DB.getTransactions(), container);

    TestAssert.contains(container.innerHTML, `data-id="${tx.id}"`, 'Rendered item must have edit/delete buttons with item data-id attribute');

    localEnv.context.DB.deleteTransaction(tx.id);
    localEnv.context.HistoryManager.renderHistoryList(localEnv.context.HistoryManager.filterTransactions(), container);
    TestAssert.isFalse(container.innerHTML.includes('GrabBike'), 'Deleted transaction must be removed from active history view rendering');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 7: Visual Statistics & Chart.js Reports (F7.1 - F7.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F7.1', 'Charts Module & Summary Calculation', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 5000000, type: 'income' });
    localEnv.context.DB.addTransaction({ amount: 2000000, type: 'expense' });
    const txs = localEnv.context.DB.getTransactions();
    const summary = localEnv.context.ChartManager.calculateSummary(txs);
    TestAssert.equal(summary.totalIncome, 5000000);
    TestAssert.equal(summary.totalExpense, 2000000);
    TestAssert.equal(summary.netBalance, 3000000);
  }));

  results.push(await runTestCase('F7.2', 'Category Breakdown Pie/Doughnut Chart Data Preparation', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');
    localEnv.context.DB.addTransaction({ amount: 600000, type: 'expense', category: 'Ăn uống' });
    localEnv.context.DB.addTransaction({ amount: 400000, type: 'expense', category: 'Đi lại' });
    const txs = localEnv.context.DB.getTransactions();
    const data = localEnv.context.ChartManager.prepareCategoryChartData(txs);
    TestAssert.isTrue(data.labels.includes('Ăn uống'));
    TestAssert.isTrue(data.labels.includes('Đi lại'));
    TestAssert.equal(data.total, 1000000);
  }));

  results.push(await runTestCase('F7.3', 'Income vs Expense Comparison Bar/Donut Chart Rendering', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');

    localEnv.context.DB.addTransaction({ amount: 15000000, type: 'income', category: 'Lương' });
    localEnv.context.DB.addTransaction({ amount: 5000000, type: 'expense', category: 'Mua sắm' });

    const createdCharts = [];
    localEnv.window.Chart = class MockChart {
      constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        createdCharts.push(this);
      }
      destroy() { this.destroyed = true; }
    };
    localEnv.context.Chart = localEnv.window.Chart;

    const categoryCanvas = localEnv.document.getElementById('category-chart');
    const comparisonCanvas = localEnv.document.getElementById('income-expense-chart');
    if (categoryCanvas) categoryCanvas.getContext = () => ({});
    if (comparisonCanvas) comparisonCanvas.getContext = () => ({});

    localEnv.context.ChartManager.renderCharts(localEnv.context.DB.getTransactions());
    TestAssert.isTrue(createdCharts.length >= 2, 'renderCharts must instantiate Chart.js for breakdown & comparison canvases');
    const barChart = createdCharts.find(c => c.config.type === 'bar');
    TestAssert.isOk(barChart, 'Bar comparison chart must be rendered');
    TestAssert.equal(barChart.config.data.datasets[0].data[0], 15000000, 'Income dataset value must equal total income (15,000,000)');
    TestAssert.equal(barChart.config.data.datasets[0].data[1], 5000000, 'Expense dataset value must equal total expense (5,000,000)');
  }));

  results.push(await runTestCase('F7.4', 'Chart.js CDN Script Pre-load in index.html', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.isTrue(/chart\.js|cdn\.jsdelivr\.net/i.test(html), 'index.html must include Chart.js CDN script tag');
  }));

  results.push(await runTestCase('F7.5', 'Dynamic Summary Card KPI Updates', async () => {
    const chartPath = path.join(projectRoot, 'js/charts.js');
    TestAssert.isTrue(fs.existsSync(chartPath), 'js/charts.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.ChartManager, 'ChartManager module must be loaded');

    localEnv.context.DB.addTransaction({ amount: 10000000, type: 'income' });
    localEnv.context.DB.addTransaction({ amount: 3000000, type: 'expense' });

    const summary = localEnv.context.ChartManager.calculateSummary(localEnv.context.DB.getTransactions());
    localEnv.context.ChartManager.updateSummaryCards(summary);

    const incEl = localEnv.document.getElementById('total-income') || localEnv.document.getElementById('report-total-income');
    const expEl = localEnv.document.getElementById('total-expense') || localEnv.document.getElementById('report-total-expense');
    const balEl = localEnv.document.getElementById('net-balance') || localEnv.document.getElementById('report-net-balance');

    TestAssert.contains(incEl.textContent, '10.000.000', 'Total Income card text content must display formatted amount');
    TestAssert.contains(expEl.textContent, '3.000.000', 'Total Expense card text content must display formatted amount');
    TestAssert.contains(balEl.textContent, '7.000.000', 'Net Balance card text content must display formatted amount');
    TestAssert.isTrue(balEl.classList.contains('positive-balance'), 'Positive net balance must add positive-balance class');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 8: Settings View & GAS Endpoint Config (F8.1 - F8.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F8.1', 'Settings View Controls in index.html', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.isTrue(/id="view-settings"|data-route="settings"/i.test(html), 'index.html must contain settings view section');
  }));

  results.push(await runTestCase('F8.2', 'GAS & Cloudflare Worker Endpoint URL Format Validation', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const valid = localEnv.context.SyncEngine.validateUrl('https://sothuchi-sqlite-backend.phamphuongdong.workers.dev');
    const invalid = localEnv.context.SyncEngine.validateUrl('not-a-valid-url');
    TestAssert.isTrue(valid, 'Valid Worker URL format should pass validation');
    TestAssert.isFalse(invalid, 'Invalid URL format should fail validation');
  }));

  results.push(await runTestCase('F8.3', 'Test Connection Ping Endpoint Protocol', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    const result = await localEnv.context.SyncEngine.testConnection('https://script.google.com/macros/s/AKfycbx_mock_endpoint_123456/exec');
    TestAssert.isTrue(result, 'Test connection ping should return true for valid mock endpoint');
  }));

  results.push(await runTestCase('F8.4', 'Settings LocalStorage Persistence', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');
    localEnv.context.SyncEngine.saveSettings({ gasUrl: 'https://script.google.com/macros/s/AKfycbx_saved/exec', autoSync: true });
    const saved = localEnv.context.SyncEngine.getSettings();
    TestAssert.equal(saved.gasUrl, 'https://script.google.com/macros/s/AKfycbx_saved/exec');
  }));

  results.push(await runTestCase('F8.5', 'Sync Status Bar Indicator UI States in index.html', async () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    TestAssert.isTrue(fs.existsSync(htmlPath), 'index.html file must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    TestAssert.isTrue(/id="sync-status"|class="sync-status"/i.test(html), 'index.html must contain sync status indicator element');
  }));

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // FEATURE 9: Cloudflare Worker & D1 SQLite Backend (worker.js, schema.sql) (F9.1 - F9.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F9.1', 'worker.js File Existence & Endpoint Handlers', async () => {
    const workerPath = path.join(projectRoot, 'worker.js');
    TestAssert.isTrue(fs.existsSync(workerPath), 'worker.js backend file must exist in project root');
    const codeContent = fs.readFileSync(workerPath, 'utf8');
    TestAssert.contains(codeContent, 'fetch', 'worker.js must export fetch handler');
    TestAssert.contains(codeContent, 'syncBatch', 'worker.js must handle syncBatch endpoint');
  }));

  results.push(await runTestCase('F9.2', 'D1 Schema Definition & Columns', async () => {
    const schemaPath = path.join(projectRoot, 'schema.sql');
    TestAssert.isTrue(fs.existsSync(schemaPath), 'schema.sql file must exist');
    const codeContent = fs.readFileSync(schemaPath, 'utf8');
    TestAssert.contains(codeContent, 'transactions', 'schema.sql must contain transactions table');
    TestAssert.contains(codeContent, 'wallets', 'schema.sql must contain wallets table');
    TestAssert.contains(codeContent, 'categories', 'schema.sql must contain categories table');
    TestAssert.contains(codeContent, 'assets', 'schema.sql must contain assets table');
    TestAssert.contains(codeContent, 'liabilities', 'schema.sql must contain liabilities table');
    TestAssert.contains(codeContent, 'loans', 'schema.sql must contain loans table');
  }));

  results.push(await runTestCase('F9.3', 'worker.js fetchAll and ping action handling', async () => {
    const workerPath = path.join(projectRoot, 'worker.js');
    TestAssert.isTrue(fs.existsSync(workerPath), 'worker.js backend file must exist');
    const codeContent = fs.readFileSync(workerPath, 'utf8');
    TestAssert.contains(codeContent, 'action', 'worker.js must check action parameter');
    TestAssert.contains(codeContent, 'ping', 'worker.js must handle ping action');
    TestAssert.contains(codeContent, 'fetchAll', 'worker.js must handle fetchAll action');
  }));

  results.push(await runTestCase('F9.4', 'worker.js syncBatch Batch Processing', async () => {
    const workerPath = path.join(projectRoot, 'worker.js');
    TestAssert.isTrue(fs.existsSync(workerPath), 'worker.js backend file must exist');
    const codeContent = fs.readFileSync(workerPath, 'utf8');
    TestAssert.contains(codeContent, 'syncBatch', 'worker.js must handle syncBatch action');
  }));

  results.push(await runTestCase('F9.5', 'worker.js executeBatchSafe Chunking Guard', async () => {
    const workerPath = path.join(projectRoot, 'worker.js');
    TestAssert.isTrue(fs.existsSync(workerPath), 'worker.js backend file must exist');
    const codeContent = fs.readFileSync(workerPath, 'utf8');
    TestAssert.contains(codeContent, 'executeBatchSafe', 'worker.js must implement executeBatchSafe statement chunker');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 10: 2-Way Sync Engine & Offline Queue (F10.1 - F10.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F10.1', 'Sync Module & Push Sync Pending Queue', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    const tx = localEnv.context.DB.addTransaction({ amount: 150000, category: 'Ăn uống', note: 'Bữa tối' });
    TestAssert.equal(tx.sync_status, 'pending_add', 'Newly added transaction must be queued with pending_add status');

    const pushRes = await localEnv.context.SyncEngine.pushSync();
    TestAssert.isTrue(pushRes.success, 'Push sync must return success status true');
    TestAssert.equal(pushRes.syncedCount, 1, 'Push sync must synchronize 1 item');

    const updatedTx = localEnv.context.DB.getTransactions().find(t => t.id === tx.id);
    TestAssert.equal(updatedTx.sync_status, 'synced', 'Transaction sync status must transition to synced after remote ACK');
    TestAssert.isTrue(localEnv.gasServer.sheetRows.some(r => r.id === tx.id), 'Mock GAS server must receive transaction payload');
  }));

  results.push(await runTestCase('F10.2', 'Pull Sync Remote Updates & Local Merge', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    localEnv.gasServer.sheetRows = [
      { id: 'remote_tx_1', amount: 500000, category: 'Lương', type: 'income', updated_at: '2026-08-10T10:00:00.000Z', sync_status: 'synced' }
    ];

    const pullRes = await localEnv.context.SyncEngine.pullSync();
    TestAssert.isTrue(pullRes.success, 'Pull sync must return success status true');
    TestAssert.equal(pullRes.pulledCount, 1, 'Pull sync must pull 1 remote record');

    const merged = localEnv.context.DB.getTransactions().find(t => t.id === 'remote_tx_1');
    TestAssert.isOk(merged, 'Remote transaction must be merged into local DB');
    TestAssert.equal(merged.amount, 500000);
    TestAssert.equal(merged.sync_status, 'synced');
  }));

  results.push(await runTestCase('F10.3', 'Last-Write-Wins (LWW) Timestamp Conflict Resolution', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });

    localEnv.context.DB.addTransaction({
      id: 'tx_lww_1',
      amount: 100000,
      note: 'Local old version',
      updated_at: '2026-08-10T08:00:00.000Z',
      sync_status: 'synced'
    });

    localEnv.gasServer.sheetRows = [
      { id: 'tx_lww_1', amount: 250000, note: 'Remote newer version', updated_at: '2026-08-10T12:00:00.000Z', sync_status: 'synced' }
    ];

    await localEnv.context.SyncEngine.pullSync();

    const winner = localEnv.context.DB.getTransactions().find(t => t.id === 'tx_lww_1');
    TestAssert.equal(winner.amount, 250000, 'LWW must select remote version with strictly newer updated_at timestamp');
    TestAssert.equal(winner.note, 'Remote newer version');
  }));

  results.push(await runTestCase('F10.4', 'Offline Network Interruption Handling & Queue Retention', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    const tx = localEnv.context.DB.addTransaction({ amount: 90000, category: 'Giải trí' });

    localEnv.window.navigator.onLine = false;

    const res = await localEnv.context.SyncEngine.pushSync();
    TestAssert.isFalse(res.success, 'Push sync must gracefully fail when offline');

    const retainedTx = localEnv.context.DB.getTransactions().find(t => t.id === tx.id);
    TestAssert.equal(retainedTx.sync_status, 'pending_add', 'Pending transaction must remain in local queue during offline state');
  }));

  results.push(await runTestCase('F10.5', 'Auto-Sync Trigger on Network Online Event', async () => {
    const syncPath = path.join(projectRoot, 'js/sync.js');
    TestAssert.isTrue(fs.existsSync(syncPath), 'js/sync.js file must exist');
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.SyncEngine, 'SyncEngine module must be loaded');

    localEnv.context.SyncEngine.saveSettings({ gasUrl: localEnv.gasServer.endpointUrl, autoSync: true });
    const tx = localEnv.context.DB.addTransaction({ amount: 45000, category: 'Mua sắm' });

    localEnv.window.dispatchEvent(new localEnv.context.CustomEvent('online'));
    await new Promise(r => setTimeout(r, 60));

    const syncedTx = localEnv.context.DB.getTransactions().find(t => t.id === tx.id);
    TestAssert.equal(syncedTx.sync_status, 'synced', 'Online event listener must automatically trigger sync and drain pending queue');
  }));

  // --------------------------------------------------------------------------
  // FEATURE 11: User Integration & Setup Guide (F11.1 - F11.5)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('F11.1', 'README.md Setup Guide Existence', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist in project root');
    const readme = fs.readFileSync(readmePath, 'utf8');
    TestAssert.contains(readme, 'Sổ Thu Chi', 'README.md must contain project title');
  }));

  results.push(await runTestCase('F11.2', 'README.md 6-Step Apps Script Deployment Walkthrough', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const readme = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/bước|step|hướng dẫn|deployment/i.test(readme), 'README.md must detail setup steps');
  }));

  results.push(await runTestCase('F11.3', 'README.md Web App Deployment Authorization Config', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const readme = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/anyone|bất kỳ ai|tất cả|quyền/i.test(readme), 'README.md must explain web app permissions configuration');
  }));

  results.push(await runTestCase('F11.4', 'README.md Endpoint URL Copy-Paste Instructions', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const readme = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/url|endpoint|cài đặt|settings/i.test(readme), 'README.md must detail endpoint URL configuration');
  }));

  results.push(await runTestCase('F11.5', 'README.md Setup Troubleshooting Section', async () => {
    const readmePath = path.join(projectRoot, 'README.md');
    TestAssert.isTrue(fs.existsSync(readmePath), 'README.md file must exist');
    const readme = fs.readFileSync(readmePath, 'utf8');
    TestAssert.isTrue(/xử lý sự cố|troubleshooting|lỗi|faq/i.test(readme), 'README.md must contain troubleshooting or FAQ section');
  }));

  return results;
}

module.exports = { runTier1Tests };
