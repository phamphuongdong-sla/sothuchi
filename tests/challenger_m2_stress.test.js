/**
 * tests/challenger_m2_stress.test.js
 * Empirical Stress Test Harness for Milestone M2: Finance Core & Category Management
 */

const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runM2StressTests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  console.log('\n================================================================');
  console.log(' EMPIRICAL STRESS & BOUNDARY HARNESS — MILESTONE M2');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Large Transaction Volumes Stress (5,000 Transactions)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('STRESS-M2-1', 'Large Volume Stress (5,000 transactions CRUD & filtering speed)', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const startTime = Date.now();
    const batch = [];
    const categories = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn', 'Giải trí', 'Lương', 'Thưởng'];

    for (let i = 0; i < 5000; i++) {
      batch.push({
        id: `tx_stress_${i}`,
        date: `2026-0${(i % 9) + 1}-15`,
        type: i % 5 === 0 ? 'income' : 'expense',
        category: categories[i % categories.length],
        amount: (i + 1) * 1000,
        note: `Giao dịch stress test số ${i}`,
        created_at: new Date(1700000000000 + i * 1000).toISOString(),
        sync_status: i % 10 === 0 ? 'synced' : 'pending_add'
      });
    }

    // Save batch to storage
    env.db.saveTransactions(batch);
    const saveTime = Date.now() - startTime;

    // Retrieve & filter
    const fetchStart = Date.now();
    const allTxs = env.db.getTransactions();
    TestAssert.equal(allTxs.length, 5000, 'Should load all 5,000 transactions');

    const foodTxs = env.db.getTransactions({ category: 'Ăn uống' });
    const fetchTime = Date.now() - fetchStart;

    console.log(`   ⏱️ Performance: 5,000 items saved in ${saveTime}ms, loaded/filtered in ${fetchTime}ms`);
    TestAssert.isTrue(saveTime < 3000, `Bulk save took ${saveTime}ms, expected under 3000ms`);
    TestAssert.isTrue(fetchTime < 1000, `Filtered fetch took ${fetchTime}ms, expected under 1000ms`);
  }));

  // --------------------------------------------------------------------------
  // TEST 2: Quota Exceeded Exception Handling
  // --------------------------------------------------------------------------
  results.push(await runTestCase('STRESS-M2-2', 'LocalStorage QuotaExceeded error handling in DB and Categories', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    env.localStorage.throwQuotaError = true;

    // Test addTransaction under Quota Error
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 50000, category: 'Ăn uống' });
    }, /Quota Exceeded|Dung lượng lưu trữ trình duyệt đã đầy/i, 'DB.addTransaction must catch quota error and throw descriptive Vietnamese error');

    // Test updateTransaction under Quota Error
    env.localStorage.throwQuotaError = false;
    const tx = env.db.addTransaction({ amount: 10000, category: 'Ăn uống' });
    env.localStorage.throwQuotaError = true;

    TestAssert.throws(() => {
      env.db.updateTransaction(tx.id, { amount: 20000 });
    }, /Quota Exceeded|Dung lượng lưu trữ trình duyệt đã đầy/i, 'DB.updateTransaction must handle quota error');

    // Test CategoryManager under Quota Error
    env.localStorage.throwQuotaError = false;
    env.loadSourceFiles();
    env.localStorage.throwQuotaError = true;

    TestAssert.doesNotThrow(() => {
      // saveToStorage catches and logs error gracefully without crashing
      env.categoryManager.addCategory({ name: 'Hạng mục mới', type: 'expense' });
    }, 'CategoryManager handles quota error gracefully without crashing app');
  }));

  // --------------------------------------------------------------------------
  // TEST 3: JSON Corruption & Recovery (Truncated / Invalid JSON in LocalStorage)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('STRESS-M2-3', 'JSON Corruption & Fallback Recovery for Transactions & Categories', async () => {
    const env = new TestEnvironment(projectRoot);
    
    // Corrupt transactions key
    env.localStorage.setItem('stc_transactions', '{ "incomplete_json": [1, 2, ');
    // Corrupt categories key
    env.localStorage.setItem('stc_categories', 'CORRUPTED_NON_JSON_DATA_XYZ');
    
    env.loadSourceFiles();

    // DB fallback
    const txs = env.db.getTransactions();
    TestAssert.deepEqual(txs, [], 'Corrupted transactions storage must fall back to []');

    // Categories fallback to default categories
    const cats = env.categoryManager.getAll();
    TestAssert.isTrue(cats.length >= 12, 'Corrupted category storage must fall back to default categories (>= 12)');
  }));

  // --------------------------------------------------------------------------
  // TEST 4: Rapid Form Resets & Switcher Race Conditions
  // --------------------------------------------------------------------------
  results.push(await runTestCase('STRESS-M2-4', 'Rapid form switching, resets, and VND live formatting', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const form = env.document.getElementById('transaction-form');
    const amountInput = env.document.getElementById('input-amount');
    const noteInput = env.document.getElementById('input-note');
    const categorySelect = env.document.getElementById('input-category');
    const incomeRadio = env.document.getElementById('type-income');
    const expenseRadio = env.document.getElementById('type-expense');

    // Rapid toggle 50 times
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        incomeRadio.checked = true;
        incomeRadio.dispatchEvent({ type: 'change' });
      } else {
        expenseRadio.checked = true;
        expenseRadio.dispatchEvent({ type: 'change' });
      }
    }

    TestAssert.isTrue(categorySelect.children.length > 1, 'Category select dropdown should remain populated after rapid switches');

    // Rapid input formatting
    amountInput.value = '123456789';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.equal(amountInput.value, '123.456.789', 'VND formatting must convert 123456789 to 123.456.789');

    // Rapid submit & reset
    noteInput.value = 'Coffee & Snack ☕';
    form.dispatchEvent({ type: 'submit' });

    TestAssert.equal(amountInput.value, '', 'Amount field reset');
    TestAssert.equal(noteInput.value, '', 'Note field reset');
    
    const saved = env.db.getTransactions();
    TestAssert.equal(saved.length, 1);
    TestAssert.equal(saved[0].amount, 123456789);
    TestAssert.equal(saved[0].note, 'Coffee & Snack ☕');
  }));

  // --------------------------------------------------------------------------
  // TEST 5: Category Boundaries (Duplicate, Whitespace, Emoji, Soft-hide limits)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('STRESS-M2-5', 'Category Boundary Conditions (Duplicates, Emojis, Soft-hide limits)', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Whitespace trimming & Duplicate check (case-insensitive)
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '  Ăn uống   ', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/, 'Must block duplicate category name with surrounding whitespace');

    // Add unicode emoji category
    const catEmoji = env.categoryManager.addCategory({ name: 'Thức ăn 🍣🍱', type: 'expense', icon: '🍣' });
    TestAssert.equal(catEmoji.name, 'Thức ăn 🍣🍱');

    // Soft-hide constraint: test hiding income categories until 1 remains
    const incomeCats = env.categoryManager.getAll('income');
    for (let i = 0; i < incomeCats.length - 1; i++) {
      env.categoryManager.hideCategory(incomeCats[i].id);
    }
    const activeIncome = env.categoryManager.getActive('income');
    TestAssert.equal(activeIncome.length, 1, 'Only 1 active income category remaining');

    // Attempt to hide the final active income category
    TestAssert.throws(() => {
      env.categoryManager.toggleHideCategory(activeIncome[0].id);
    }, /Phải giữ ít nhất 1 hạng mục hoạt động/, 'Cannot hide the last active category');
  }));

  // Print Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` M2 STRESS TEST SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ STRESS TESTS FAILED: ${failed} tests failed!`);
  } else {
    console.log('✅ ALL M2 STRESS & BOUNDARY TESTS PASSED SUCCESSFULLY!');
  }

  return results;
}

if (require.main === module) {
  runM2StressTests().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runM2StressTests };
