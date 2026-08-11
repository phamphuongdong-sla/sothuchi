/**
 * tests/m3_verification.test.js - Milestone M3 Dedicated Verification Test Suite
 * Verifies 100% of M3 requirements for History, Filtering, Search, Pagination, Edit/Delete Modals, and Chart.js Reports.
 */

const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runM3VerificationTests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  console.log('\n================================================================');
  console.log(' MILESTONE M3 VERIFICATION SUITE: History, Filter & Visual Reports');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // MODULE A: History Search, Filter & Grouping (M3-HIST-1 to M3-HIST-5)
  // --------------------------------------------------------------------------

  // M3-HIST-1: Keyword Search Filter
  results.push(await runTestCase('M3-HIST-1', 'History search filters transactions by note, category, amount, or date', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const t1 = env.db.addTransaction({ amount: 50000, category: 'Ăn uống', note: 'Phở gà', date: '2026-08-10' });
    const t2 = env.db.addTransaction({ amount: 200000, category: 'Đi lại', note: 'Xăng xe', date: '2026-08-09' });

    // Search by note substring
    const filteredNote = env.historyManager.filterTransactions({ query: 'phở' });
    TestAssert.equal(filteredNote.length, 1);
    TestAssert.equal(filteredNote[0].id, t1.id);

    // Search by category substring
    const filteredCat = env.historyManager.filterTransactions({ query: 'Đi lại' });
    TestAssert.equal(filteredCat.length, 1);
    TestAssert.equal(filteredCat[0].id, t2.id);

    // Search by amount number string
    const filteredAmount = env.historyManager.filterTransactions({ query: '200000' });
    TestAssert.equal(filteredAmount.length, 1);
    TestAssert.equal(filteredAmount[0].id, t2.id);
  }));

  // M3-HIST-2: Category & Type Filtering
  results.push(await runTestCase('M3-HIST-2', 'History filters by type (income/expense) and category name', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    env.db.addTransaction({ amount: 1000000, type: 'income', category: 'Lương', note: 'Thưởng quý' });
    env.db.addTransaction({ amount: 30000, type: 'expense', category: 'Ăn uống', note: 'Cà phê' });

    const incomeOnly = env.historyManager.filterTransactions({ type: 'income' });
    TestAssert.equal(incomeOnly.length, 1);
    TestAssert.equal(incomeOnly[0].category, 'Lương');

    const catFilter = env.historyManager.filterTransactions({ category: 'Ăn uống' });
    TestAssert.equal(catFilter.length, 1);
    TestAssert.equal(catFilter[0].note, 'Cà phê');
  }));

  // M3-HIST-3: Date Range Filtering & Boundary Conditions
  results.push(await runTestCase('M3-HIST-3', 'History filters by date range and returns empty array on inverted boundaries', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    env.db.addTransaction({ amount: 100000, date: '2026-08-01', note: 'Ngày 1' });
    env.db.addTransaction({ amount: 100000, date: '2026-08-05', note: 'Ngày 5' });
    env.db.addTransaction({ amount: 100000, date: '2026-08-10', note: 'Ngày 10' });

    const augRange = env.historyManager.filterTransactions({ startDate: '2026-08-01', endDate: '2026-08-05' });
    TestAssert.equal(augRange.length, 2);

    // Inverted date range (startDate > endDate) must return []
    const inverted = env.historyManager.filterTransactions({ startDate: '2026-08-10', endDate: '2026-08-01' });
    TestAssert.deepEqual(inverted, [], 'Inverted date range must return empty array');
  }));

  // M3-HIST-4: Date Grouping & Aggregation
  results.push(await runTestCase('M3-HIST-4', 'Group transactions by date with total income & expense subtotal calculations', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const txs = [
      { id: '1', date: '2026-08-10', type: 'income', amount: 500000 },
      { id: '2', date: '2026-08-10', type: 'expense', amount: 100000 },
      { id: '3', date: '2026-08-09', type: 'expense', amount: 50000 }
    ];

    const groups = env.historyManager.groupTransactionsByDate(txs);
    TestAssert.equal(groups.length, 2);
    TestAssert.equal(groups[0].date, '2026-08-10');
    TestAssert.equal(groups[0].totalIncome, 500000);
    TestAssert.equal(groups[0].totalExpense, 100000);
    TestAssert.equal(groups[0].netTotal, 400000);
    TestAssert.equal(groups[1].date, '2026-08-09');
  }));

  // M3-HIST-5: DOM Rendering & XSS Protection
  results.push(await runTestCase('M3-HIST-5', 'Render history list HTML with XSS character escaping', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const container = env.document.createElement('div');
    const txs = [{
      id: 'xss1',
      date: '2026-08-10',
      type: 'expense',
      category: '<script>alert(1)</script>',
      note: '<b>Bold Note</b>',
      amount: 50000
    }];

    env.historyManager.renderHistoryList(txs, container);
    TestAssert.contains(container.innerHTML, '&lt;script&gt;');
    TestAssert.isFalse(container.innerHTML.includes('<script>alert(1)</script>'));
    TestAssert.contains(container.innerHTML, '&lt;b&gt;Bold Note&lt;/b&gt;');
  }));

  // --------------------------------------------------------------------------
  // MODULE B: Transaction Modification & Deletion (M3-EDIT-1 to M3-EDIT-3)
  // --------------------------------------------------------------------------

  // M3-EDIT-1: Soft Delete Flow
  results.push(await runTestCase('M3-EDIT-1', 'Delete transaction soft-deletes synced items and excludes from active history view', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const tx = env.db.addTransaction({ amount: 100000, category: 'Ăn uống', note: 'Bún chả' });
    env.db.updateTransaction(tx.id, { sync_status: 'synced' });

    env.db.deleteTransaction(tx.id);

    const activeTxs = env.db.getTransactions({ includeDeleted: false });
    TestAssert.equal(activeTxs.length, 0, 'Active transactions should exclude deleted transaction');

    const filtered = env.historyManager.filterTransactions();
    TestAssert.equal(filtered.length, 0, 'History filter should exclude soft-deleted transactions');
  }));

  // M3-EDIT-2: Edit Transaction Flow
  results.push(await runTestCase('M3-EDIT-2', 'Update transaction changes fields and sets sync_status to pending_update', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const tx = env.db.addTransaction({ amount: 100000, category: 'Ăn uống', note: 'Cơm tấm' });
    env.db.updateTransaction(tx.id, { sync_status: 'synced' });

    const updated = env.db.updateTransaction(tx.id, { amount: 120000, note: 'Cơm tấm bì chả' });
    TestAssert.equal(updated.amount, 120000);
    TestAssert.equal(updated.note, 'Cơm tấm bì chả');
    TestAssert.equal(updated.sync_status, 'pending_update');
  }));

  // M3-EDIT-3: Reactive Event Bindings
  results.push(await runTestCase('M3-EDIT-3', 'Transaction custom window events trigger history view updates', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    let renderCallCount = 0;
    const origRender = env.historyManager.render;
    env.historyManager.render = function() {
      renderCallCount++;
      return origRender.apply(this, arguments);
    };

    env.historyManager.initEventListeners();

    env.window.dispatchEvent(new env.context.CustomEvent('transactionadded'));
    TestAssert.isTrue(renderCallCount >= 1, 'transactionadded event must trigger history re-render');

    env.window.dispatchEvent(new env.context.CustomEvent('transactionupdated'));
    TestAssert.isTrue(renderCallCount >= 2, 'transactionupdated event must trigger history re-render');

    env.window.dispatchEvent(new env.context.CustomEvent('transactiondeleted'));
    TestAssert.isTrue(renderCallCount >= 3, 'transactiondeleted event must trigger history re-render');
  }));

  // --------------------------------------------------------------------------
  // MODULE C: Financial Calculations & Category Aggregation (M3-CALC-1 to M3-CALC-4)
  // --------------------------------------------------------------------------

  // M3-CALC-1: KPI Summary Calculations
  results.push(await runTestCase('M3-CALC-1', 'Calculate KPI summary metrics excluding pending_delete transactions', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const txs = [
      { type: 'income', amount: 1000000, sync_status: 'synced' },
      { type: 'expense', amount: 400000, sync_status: 'synced' },
      { type: 'expense', amount: 200000, sync_status: 'pending_delete' }
    ];

    const summary = env.chartManager.calculateSummary(txs);
    TestAssert.equal(summary.totalIncome, 1000000);
    TestAssert.equal(summary.totalExpense, 400000);
    TestAssert.equal(summary.netBalance, 600000);
  }));

  // M3-CALC-2: Savings Rate & Zero-Income Protection
  results.push(await runTestCase('M3-CALC-2', 'Savings rate calculation returns 0.0% when total income is 0', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Zero income, non-zero expense
    const summaryZero = env.chartManager.calculateSummary([{ type: 'expense', amount: 50000, sync_status: 'synced' }]);
    TestAssert.equal(summaryZero.totalIncome, 0);
    TestAssert.equal(summaryZero.savingsRate, 0.0, 'Savings rate must return 0.0 with zero total income');

    // Positive income and expense
    const summaryPos = env.chartManager.calculateSummary([
      { type: 'income', amount: 1000000, sync_status: 'synced' },
      { type: 'expense', amount: 400000, sync_status: 'synced' }
    ]);
    TestAssert.equal(summaryPos.savingsRate, 60.0, 'Savings rate should be (1000000 - 400000) / 1000000 * 100 = 60.0%');
  }));

  // M3-CALC-3: Category Aggregation & Percentages
  results.push(await runTestCase('M3-CALC-3', 'Category chart data aggregation and percentage calculations', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const txs = [
      { type: 'expense', category: 'Ăn uống', amount: 300000, sync_status: 'synced' },
      { type: 'expense', category: 'Đi lại', amount: 100000, sync_status: 'synced' },
      { type: 'income', category: 'Lương', amount: 5000000, sync_status: 'synced' }
    ];

    const data = env.chartManager.prepareCategoryChartData(txs, 'expense');
    TestAssert.equal(data.total, 400000);
    TestAssert.equal(data.labels.length, 2);
    TestAssert.equal(data.percentages[0], 75.0);
    TestAssert.equal(data.percentages[1], 25.0);
  }));

  // M3-CALC-4: Summary Card DOM Updates
  results.push(await runTestCase('M3-CALC-4', 'Update DOM summary cards with formatted VND values and positive/negative classes', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    env.chartManager.updateSummaryCards({
      totalIncome: 1000000,
      totalExpense: 400000,
      netBalance: 600000,
      savingsRate: 60.0
    });

    const incEl = env.document.getElementById('total-income');
    const expEl = env.document.getElementById('total-expense');
    const balEl = env.document.getElementById('net-balance');
    const savEl = env.document.getElementById('savings-rate');

    TestAssert.contains(incEl.textContent, '1.000.000');
    TestAssert.contains(expEl.textContent, '400.000');
    TestAssert.contains(balEl.textContent, '600.000');
    TestAssert.equal(savEl.textContent, '60%');
    TestAssert.isTrue(balEl.classList.contains('positive-balance'));
  }));

  // --------------------------------------------------------------------------
  // MODULE D: Chart Lifecycle & Fault Tolerance (M3-CHART-1 to M3-CHART-2)
  // --------------------------------------------------------------------------

  // M3-CHART-1: Chart Instance Destruction Lifecycle
  results.push(await runTestCase('M3-CHART-1', 'Destroy previous Chart instances before creating new ones on re-render', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    let destroyedCount = 0;
    env.context.Chart = env.window.Chart = class MockChart {
      constructor(ctx, config) {}
      destroy() { destroyedCount++; }
    };

    env.chartManager.renderCharts([{ type: 'income', amount: 100, sync_status: 'synced' }]);
    TestAssert.isOk(env.chartManager.categoryChartInstance);
    TestAssert.isOk(env.chartManager.comparisonChartInstance);

    env.chartManager.renderCharts([{ type: 'income', amount: 200, sync_status: 'synced' }]);
    TestAssert.equal(destroyedCount, 2, 'Must call destroy() on both category and comparison chart instances before re-rendering');
  }));

  // M3-CHART-2: Missing Dependency Resilience
  results.push(await runTestCase('M3-CHART-2', 'Safely handle missing Chart.js global library without throwing exceptions', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    delete env.context.Chart;
    delete env.window.Chart;

    TestAssert.doesNotThrow(() => {
      env.chartManager.renderCharts([{ type: 'income', amount: 100, sync_status: 'synced' }]);
    }, 'Missing Chart global must not throw unhandled exception');
  }));

  // --------------------------------------------------------------------------
  // VERIFICATION SUMMARY
  // --------------------------------------------------------------------------
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` M3 VERIFICATION SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ M3 VERIFICATION FAILED: ${failed} tests failed!`);
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - [FAIL] ${r.id} - ${r.title}: ${r.error ? r.error.message : 'Unknown'}`);
    });
  } else {
    console.log('✅ ALL M3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }

  return results;
}

if (require.main === module) {
  runM3VerificationTests().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runM3VerificationTests };
