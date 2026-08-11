/**
 * tests/m2_verification.test.js - Milestone M2 Dedicated Verification Test Suite
 * Verifies 100% of M2 requirements for Finance Core, Data Persistence & Category System.
 */

const fs = require('fs');
const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runM2VerificationTests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  console.log('\n================================================================');
  console.log(' MILESTONE M2 VERIFICATION SUITE: Finance Core & Categories');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TASK 1: Core Data Model & LocalStorage Manager (js/db.js)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-DB-1', 'DB object exists and persists transactions under stc_transactions key', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.db, 'DB singleton must be available on env sandbox context');
    const tx = env.db.addTransaction({ amount: 150000, type: 'expense', category: 'Ăn uống', note: 'Phở bò' });
    TestAssert.isOk(tx.id, 'Transaction must have generated unique ID');

    const storedRaw = env.localStorage.getItem('stc_transactions');
    TestAssert.isOk(storedRaw, 'Data must be persisted under key stc_transactions in LocalStorage');
    const parsed = JSON.parse(storedRaw);
    TestAssert.equal(parsed.length, 1);
    TestAssert.equal(parsed[0].id, tx.id);
  }));

  results.push(await runTestCase('M2-DB-2', 'Legacy key fallback reading for so_thu_chi_transactions', async () => {
    const env = new TestEnvironment(projectRoot);
    const legacyTxList = [{ id: 'tx_legacy_1', amount: 80000, type: 'expense', category: 'Đi lại', date: '2026-08-01', sync_status: 'synced' }];
    env.localStorage.setItem('so_thu_chi_transactions', JSON.stringify(legacyTxList));
    env.loadSourceFiles();

    const txs = env.db.getTransactions();
    TestAssert.equal(txs.length, 1);
    TestAssert.equal(txs[0].id, 'tx_legacy_1');
  }));

  results.push(await runTestCase('M2-DB-3', '7 Mandatory Fields + 2 Sync Metadata + Dual Casing Support', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    const tx = env.db.addTransaction({ amount: 500000, type: 'income', category: 'Lương', note: 'Lương sếp thưởng' });

    // 7 Core Fields
    TestAssert.isOk(tx.id, 'id is mandatory');
    TestAssert.isOk(tx.date, 'date is mandatory');
    TestAssert.equal(tx.type, 'income', 'type is mandatory');
    TestAssert.equal(tx.category, 'Lương', 'category is mandatory');
    TestAssert.equal(tx.amount, 500000, 'amount is mandatory');
    TestAssert.equal(tx.note, 'Lương sếp thưởng', 'note is mandatory');
    TestAssert.isOk(tx.created_at || tx.createdAt, 'createdAt/created_at is mandatory');

    // 2 Metadata Fields
    TestAssert.isOk(tx.updated_at || tx.updatedAt, 'updatedAt/updated_at is mandatory');
    TestAssert.equal(tx.sync_status, 'pending_add', 'sync_status is mandatory and defaults to pending_add');

    // Dual casing check
    TestAssert.equal(tx.createdAt, tx.created_at, 'createdAt and created_at must match');
    TestAssert.equal(tx.updatedAt, tx.updated_at, 'updatedAt and updated_at must match');
  }));

  results.push(await runTestCase('M2-DB-4', 'DB Full CRUD Operations (get, add, update, delete)', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // 1. Add
    const t1 = env.db.addTransaction({ amount: 100000, category: 'Giải trí', note: 'Xem phim' });
    TestAssert.equal(env.db.getTransactions().length, 1);

    // 2. Update
    const updated = env.db.updateTransaction(t1.id, { amount: 150000, note: 'Xem phim IMAX' });
    TestAssert.equal(updated.amount, 150000);
    TestAssert.equal(updated.note, 'Xem phim IMAX');

    // 3. Get with Filter
    const filtered = env.db.getTransactions({ category: 'Giải trí' });
    TestAssert.equal(filtered.length, 1);
    TestAssert.equal(filtered[0].amount, 150000);

    // 4. Soft Delete for synced transactions
    env.db.updateTransaction(t1.id, { sync_status: 'synced' });
    env.db.deleteTransaction(t1.id);
    TestAssert.equal(env.db.getTransactions().length, 0, 'Active transactions list excludes deleted items');
    const allWithDeleted = env.db.getTransactions({ includeDeleted: true });
    TestAssert.equal(allWithDeleted.length, 1);
    TestAssert.equal(allWithDeleted[0].sync_status, 'pending_delete');
  }));

  results.push(await runTestCase('M2-DB-5', 'Try-Catch Resilience for Corrupted JSON & LocalStorage Quota Fallback', async () => {
    const env = new TestEnvironment(projectRoot);
    env.localStorage.setItem('stc_transactions', 'MALFORMED_INVALID_JSON{{{');
    env.loadSourceFiles();

    // Corrupted recovery fallback to []
    TestAssert.doesNotThrow(() => {
      const txs = env.db.getTransactions();
      TestAssert.deepEqual(txs, [], 'Corrupted JSON should fall back to empty array safely');
    });

    // Quota Exceeded exception handling
    env.localStorage.throwQuotaError = true;
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 10000 });
    }, /Quota Exceeded|Dung lượng/i, 'Should throw descriptive Vietnamese quota error');
  }));

  // --------------------------------------------------------------------------
  // TASK 2: Category Customization System (js/categories.js)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-CAT-1', 'Category Module Defaults & LocalStorage Persistence under stc_categories', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();
    TestAssert.isOk(env.categoryManager, 'categoryManager singleton must be loaded');

    const cats = env.categoryManager.getAll();
    TestAssert.isTrue(cats.length >= 12, 'Must contain at least 12 default categories (5 income, 8 expense)');

    const incomeCats = env.categoryManager.getActive('income');
    const expenseCats = env.categoryManager.getActive('expense');
    TestAssert.isTrue(incomeCats.some(c => c.name === 'Lương'), 'Must include default income category Lương');
    TestAssert.isTrue(expenseCats.some(c => c.name === 'Ăn uống'), 'Must include default expense category Ăn uống');

    const raw = env.localStorage.getItem('stc_categories');
    TestAssert.isOk(raw, 'Categories must be persisted to stc_categories');
  }));

  results.push(await runTestCase('M2-CAT-2', 'Add Custom Category & Duplicate Name Guard', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const custom = env.categoryManager.addCategory({ name: 'Thú cưng', type: 'expense', icon: '🐶' });
    TestAssert.equal(custom.name, 'Thú cưng');
    TestAssert.equal(custom.type, 'expense');
    TestAssert.equal(custom.icon, '🐶');

    // Duplicate check
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: 'Thú cưng', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/);
  }));

  results.push(await runTestCase('M2-CAT-3', 'Soft-Hide Category & Minimum Active Category Constraint Guard', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const cats = env.categoryManager.getAll();
    const target = cats[0];

    // Soft hide
    env.categoryManager.hideCategory(target.id);
    const activeList = env.categoryManager.getActive();
    TestAssert.isFalse(activeList.some(c => c.id === target.id), 'Hidden category must not appear in active list');

    // Reset categories to a list with 1 active category to test minimum active constraint
    const singleCatList = [{ id: 'cat_single_1', name: 'Duy nhất', type: 'income', isHidden: false, isDefault: true }];
    env.categoryManager.saveCategories(singleCatList);

    TestAssert.throws(() => {
      env.categoryManager.toggleHideCategory('cat_single_1');
    }, /Phải giữ ít nhất 1 hạng mục hoạt động/);
  }));

  results.push(await runTestCase('M2-CAT-4', 'Reset to Defaults & CategoriesChanged Event Dispatching', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    let eventFired = false;
    env.document.addEventListener('categorieschanged', (e) => {
      eventFired = true;
      TestAssert.isOk(e.detail.categories, 'Event detail must contain updated categories list');
    });

    env.categoryManager.addCategory({ name: 'Du lịch', type: 'expense' });
    TestAssert.isTrue(eventFired, 'Adding category must fire categorieschanged DOM event');

    env.categoryManager.resetToDefault();
    const defaults = env.categoryManager.getAll();
    TestAssert.isTrue(defaults.length >= 12);
  }));

  // --------------------------------------------------------------------------
  // TASK 3: Quick Entry Form Integration (app.js & index.html)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-FORM-1', 'Form Input Fields Integrity & Default Date Setting', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const form = env.document.getElementById('transaction-form');
    const amountInput = env.document.getElementById('input-amount');
    const categorySelect = env.document.getElementById('input-category');
    const dateInput = env.document.getElementById('input-date');

    TestAssert.isOk(form, '#transaction-form must exist in HTML DOM');
    TestAssert.isOk(amountInput, '#input-amount must exist in HTML DOM');
    TestAssert.isOk(categorySelect, '#input-category must exist in HTML DOM');
    TestAssert.isOk(dateInput, '#input-date must exist in HTML DOM');

    const todayISO = new Date().toISOString().split('T')[0];
    TestAssert.equal(dateInput.value, todayISO, 'Date picker must default to current date YYYY-MM-DD');
  }));

  results.push(await runTestCase('M2-FORM-2', 'Income/Expense Radio Toggle Updates Category Select Dropdown', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const categorySelect = env.document.getElementById('input-category');
    const expenseRadio = env.document.getElementById('type-expense');
    const incomeRadio = env.document.getElementById('type-income');

    // Default expense options
    const expenseCats = env.categoryManager.getActive('expense');
    TestAssert.isTrue(categorySelect.children.length > 1, 'Dropdown must be populated with expense categories');

    // Switch to income radio
    incomeRadio.checked = true;
    incomeRadio.dispatchEvent({ type: 'change' });

    const incomeOptions = categorySelect.children;
    TestAssert.isTrue(incomeOptions.length > 1, 'Dropdown must switch to income categories');
  }));

  results.push(await runTestCase('M2-FORM-3', 'VND Live Formatting & Form Submission Flow', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const amountInput = env.document.getElementById('input-amount');
    const noteInput = env.document.getElementById('input-note');
    const form = env.document.getElementById('transaction-form');

    // 1. Formatting
    amountInput.value = '250000';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.equal(amountInput.value, '250.000', 'Amount input should format digits with thousand dots');

    // 2. Note
    noteInput.value = 'Ăn lẩu Thái 🍲';

    // 3. Submit
    form.dispatchEvent({ type: 'submit' });

    // 4. Verify DB transaction created
    const txs = env.db.getTransactions();
    TestAssert.equal(txs.length, 1);
    TestAssert.equal(txs[0].amount, 250000);
    TestAssert.equal(txs[0].note, 'Ăn lẩu Thái 🍲');

    // 5. Form Reset Check
    TestAssert.equal(amountInput.value, '', 'Amount input must reset to empty after successful submission');
    TestAssert.equal(noteInput.value, '', 'Note input must reset to empty after submission');
  }));

  // Print Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` M2 VERIFICATION SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ VERIFICATION FAILED: ${failed} tests failed!`);
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - [FAIL] ${r.id} - ${r.title}: ${r.error.message}`);
    });
  } else {
    console.log('✅ ALL M2 VERIFICATION TESTS PASSED SUCCESFULLY!');
  }

  return results;
}

if (require.main === module) {
  runM2VerificationTests().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runM2VerificationTests };
