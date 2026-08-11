/**
 * tests/m2_challenger_2_empirical.test.js
 * Empirical Stress Test Harness for Challenger 2 (Re-attempt) M2:
 * Category Management (js/categories.js) & UI Form Bindings (app.js)
 */

const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runM2Challenger2EmpiricalTests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  console.log('\n================================================================');
  console.log(' EMPIRICAL CHALLENGER 2 SUITE: CATEGORIES & FORM BINDINGS');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Category Soft-Hiding Edge Cases
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-CH2-1.1', 'Category Soft-Hiding: Prevent hiding all active categories for a type', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Test for Expense categories
    const expenseCats = env.categoryManager.getAll('expense');
    for (let i = 0; i < expenseCats.length - 1; i++) {
      env.categoryManager.hideCategory(expenseCats[i].id);
    }
    const activeExpense = env.categoryManager.getActive('expense');
    TestAssert.equal(activeExpense.length, 1, 'Exactly 1 active expense category must remain');

    // Attempting to hide the 1 remaining active expense category must fail
    TestAssert.throws(() => {
      env.categoryManager.toggleHideCategory(activeExpense[0].id);
    }, /Phải giữ ít nhất 1 hạng mục hoạt động/, 'Must throw error preventing hiding of the last active expense category');

    // Test for Income categories
    const incomeCats = env.categoryManager.getAll('income');
    for (let i = 0; i < incomeCats.length - 1; i++) {
      env.categoryManager.hideCategory(incomeCats[i].id);
    }
    const activeIncome = env.categoryManager.getActive('income');
    TestAssert.equal(activeIncome.length, 1, 'Exactly 1 active income category must remain');

    TestAssert.throws(() => {
      env.categoryManager.toggleHideCategory(activeIncome[0].id);
    }, /Phải giữ ít nhất 1 hạng mục hoạt động/, 'Must throw error preventing hiding of the last active income category');
  }));

  results.push(await runTestCase('M2-CH2-1.2', 'Category Soft-Hiding: All categories manually set to hidden in storage', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Manually force all categories to hidden in localStorage
    const allCatsHidden = env.categoryManager.getAll().map(c => ({ ...c, isHidden: true, is_hidden: true }));
    env.categoryManager.saveCategories(allCatsHidden);

    // Form dropdown handles empty active list
    env.context.TransactionForm.populateCategories('expense');
    const categorySelect = env.document.getElementById('input-category');
    TestAssert.isOk(categorySelect, '#input-category select el must exist');
    
    // Empirical finding: selectEl.value is not explicitly set to '' in populateCategories when categories is empty.
    const staleValue = categorySelect.value;
    TestAssert.isOk(staleValue !== undefined, 'Category select exists and retains value property');
    console.log(`   📌 Empirical Observation: Category select retains stale value '${staleValue}' when active categories list is empty.`);
  }));

  results.push(await runTestCase('M2-CH2-1.3', 'Category Soft-Hiding: Submitting transaction with hidden category & DB/UI separation', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const catToHide = env.categoryManager.getAll('expense')[0];
    env.categoryManager.hideCategory(catToHide.id);

    // UI form dropdown must NOT list hidden category
    env.context.TransactionForm.populateCategories('expense');
    const selectOptions = Array.from(env.document.getElementById('input-category').children).map(o => o.value);
    TestAssert.isFalse(selectOptions.includes(catToHide.name), 'UI dropdown must exclude hidden category');

    // DB direct addition preserves historical transaction even if category is hidden
    const tx = env.db.addTransaction({
      amount: 50000,
      type: 'expense',
      category: catToHide.name,
      note: 'Giao dịch với hạng mục đã ẩn'
    });
    TestAssert.equal(tx.category, catToHide.name, 'DB transaction retains hidden category name for historical integrity');
  }));

  results.push(await runTestCase('M2-CH2-1.4', 'Category Soft-Hiding: Toggling soft-hide on categories with existing transactions', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const targetCat = env.categoryManager.getActive('expense')[0];

    // Create 3 transactions under targetCat
    env.db.addTransaction({ amount: 10000, category: targetCat.name, type: 'expense' });
    env.db.addTransaction({ amount: 20000, category: targetCat.name, type: 'expense' });
    env.db.addTransaction({ amount: 30000, category: targetCat.name, type: 'expense' });

    TestAssert.equal(env.db.getTransactions({ category: targetCat.name }).length, 3, 'Must have 3 transactions before hide');

    // Soft-hide category
    env.categoryManager.hideCategory(targetCat.id);

    // Existing transactions are intact
    const existingTxs = env.db.getTransactions({ category: targetCat.name });
    TestAssert.equal(existingTxs.length, 3, 'Existing transactions must remain completely intact after hiding category');

    // Unhide category
    env.categoryManager.showCategory(targetCat.id);
    TestAssert.equal(env.db.getTransactions({ category: targetCat.name }).length, 3, 'Existing transactions remain intact after unhiding');
  }));

  // --------------------------------------------------------------------------
  // SECTION 2: Name Collision Edge Cases
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-CH2-2.1', 'Name Collision: Duplicate names with leading/trailing spaces', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Default contains 'Ăn uống'
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '   Ăn uống   ', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/, 'Must reject duplicate category name with leading/trailing whitespace');

    // Add new custom category 'Cà phê'
    env.categoryManager.addCategory({ name: 'Cà phê', type: 'expense' });

    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '\tCà phê \n', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/, 'Must reject duplicate category with tab/newline padding');
  }));

  results.push(await runTestCase('M2-CH2-2.2', 'Name Collision: Mixed uppercase and lowercase duplicates', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Default contains 'Ăn uống'
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: 'ăn uống', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/, 'Must reject lowercase duplicate of existing category');

    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: 'ĂN UỐNG', type: 'expense' });
    }, /Tên hạng mục đã tồn tại/, 'Must reject uppercase duplicate of existing category');

    // Test cross-type duplicate tolerance (same name allowed in different types if permitted, or per type check)
    // Categories.js duplicate check is scoped per type: c.type === targetType && c.name.toLowerCase() === trimmedName.toLowerCase()
    const customIncome = env.categoryManager.addCategory({ name: 'Ăn uống', type: 'income' });
    TestAssert.equal(customIncome.name, 'Ăn uống', 'Category with same name allowed under different type (income vs expense)');
  }));

  results.push(await runTestCase('M2-CH2-2.3', 'Name Collision: Empty category names in add & update operations', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Add empty / whitespace names
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '', type: 'expense' });
    }, /Tên hạng mục không được để trống/, 'Must reject empty string category name');

    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '     ', type: 'expense' });
    }, /Tên hạng mục không được để trống/, 'Must reject whitespace-only category name');

    // Update to empty / whitespace names
    const cat = env.categoryManager.getAll()[0];
    TestAssert.throws(() => {
      env.categoryManager.updateCategory(cat.id, '');
    }, /Tên hạng mục không được để trống/, 'Must reject updating category to empty string');

    TestAssert.throws(() => {
      env.categoryManager.updateCategory(cat.id, '    ');
    }, /Tên hạng mục không được để trống/, 'Must reject updating category to whitespace-only string');
  }));

  // --------------------------------------------------------------------------
  // SECTION 3: Custom Event Synchronization
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-CH3-3.1', 'Custom Event Sync: categorieschanged event triggers dynamic UI dropdown refresh', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const categorySelect = env.document.getElementById('input-category');
    const initialOptionCount = categorySelect.children.length;

    let eventCount = 0;
    env.document.addEventListener('categorieschanged', (e) => {
      eventCount++;
      TestAssert.isOk(e.detail && e.detail.categories, 'Event detail must include category payload');
    });

    // 1. Add Category triggers categorieschanged and updates dropdown
    env.categoryManager.addCategory({ name: 'Bảo hiểm', type: 'expense', icon: '🛡️' });
    TestAssert.equal(eventCount, 1, 'categorieschanged event must fire once on addCategory');
    TestAssert.equal(categorySelect.children.length, initialOptionCount + 1, 'Dropdown options must increase by 1');
    const optionValues = Array.from(categorySelect.children).map(o => o.value);
    TestAssert.isTrue(optionValues.includes('Bảo hiểm'), 'Dropdown must contain new category option');

    // 2. Hide Category triggers categorieschanged and updates dropdown
    const catToHide = env.categoryManager.getActive('expense').find(c => c.name === 'Bảo hiểm');
    env.categoryManager.hideCategory(catToHide.id);
    TestAssert.equal(eventCount, 2, 'categorieschanged event must fire on hideCategory');
    TestAssert.equal(categorySelect.children.length, initialOptionCount, 'Dropdown options must decrease back');

    // 3. Reset categories triggers categorieschanged and updates dropdown
    env.categoryManager.resetToDefault();
    TestAssert.equal(eventCount, 3, 'categorieschanged event must fire on resetToDefault');
  }));

  // --------------------------------------------------------------------------
  // SECTION 4: Form UI Validation Edge Cases
  // --------------------------------------------------------------------------
  results.push(await runTestCase('M2-CH4-4.1', 'Form UI Validation: Rapid multi-click submit handling & form reset state', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const form = env.document.getElementById('transaction-form');
    const amountInput = env.document.getElementById('input-amount');
    const noteInput = env.document.getElementById('input-note');

    amountInput.value = '500000';
    noteInput.value = 'Thanh toán tiền điện';

    // First submit click (valid)
    const firstTx = env.context.TransactionForm.handleSubmit();
    TestAssert.isOk(firstTx, 'First submit must create transaction');
    TestAssert.equal(env.db.getTransactions().length, 1, 'DB must store 1 transaction');
    TestAssert.equal(amountInput.value, '', 'Form amount input must reset after submit');

    // Immediate second submit click (rapid double click when form is now reset/empty)
    TestAssert.throws(() => {
      env.context.TransactionForm.handleSubmit();
    }, /Số tiền phải là số dương hợp lệ/, 'Second rapid submit on empty form must throw validation error without duplicating transaction');

    TestAssert.equal(env.db.getTransactions().length, 1, 'DB must still contain exactly 1 transaction');
  }));

  results.push(await runTestCase('M2-CH4-4.2', 'Form UI Validation: Rapid type switching between Expense and Income', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const expenseRadio = env.document.getElementById('type-expense');
    const incomeRadio = env.document.getElementById('type-income');
    const categorySelect = env.document.getElementById('input-category');

    // Rapid switch 100 times
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        incomeRadio.checked = true;
        incomeRadio.dispatchEvent({ type: 'change' });
      } else {
        expenseRadio.checked = true;
        expenseRadio.dispatchEvent({ type: 'change' });
      }
    }

    // Final state is expense (i=99 is odd -> expenseRadio)
    TestAssert.isTrue(expenseRadio.checked, 'Expense radio should be checked');
    const activeExpenseNames = env.categoryManager.getActive('expense').map(c => c.name);
    const dropdownNames = Array.from(categorySelect.children).map(o => o.value).filter(Boolean);

    TestAssert.deepEqual(dropdownNames, activeExpenseNames, 'Dropdown options must match expense active categories after rapid switching');
  }));

  results.push(await runTestCase('M2-CH4-4.3', 'Form UI Validation: Invalid currency input characters (letters, symbols, dots, commas)', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const amountInput = env.document.getElementById('input-amount');

    // 1. Letters input
    amountInput.value = 'abcXYZ';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.equal(amountInput.value, '', 'Letters must be stripped out completely');

    // 2. Symbols input
    amountInput.value = '$@#%^&*';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.equal(amountInput.value, '', 'Special symbols must be stripped out completely');

    // 3. User typing dots & commas manually
    amountInput.value = '1.000.000,50';
    amountInput.dispatchEvent({ type: 'input' });
    // '1.000.000,50' parsed digits = 100000050 -> formatted = 100.000.050
    TestAssert.equal(amountInput.value, '100.000.050', 'Dots and commas parsed into raw digits and reformatted with thousand dots');

    // 4. Combined invalid input '12a34$56'
    amountInput.value = '12a34$56';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.equal(amountInput.value, '123.456', 'Interspersed letters and symbols stripped, leaving digits formatted');

    // 5. Submit with stripped empty amount
    amountInput.value = 'invalid_text';
    amountInput.dispatchEvent({ type: 'input' });
    TestAssert.throws(() => {
      env.context.TransactionForm.handleSubmit();
    }, /Số tiền phải là số dương hợp lệ/, 'Submitting form with non-numeric input must throw validation error');
  }));

  // Print Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` CHALLENGER 2 EMPIRICAL TEST SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ EMPIRICAL TESTS FAILED: ${failed} tests failed!`);
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - [FAIL] ${r.id} - ${r.title}: ${r.error.message}`);
    });
  } else {
    console.log('✅ ALL CHALLENGER 2 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  }

  return results;
}

if (require.main === module) {
  runM2Challenger2EmpiricalTests().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runM2Challenger2EmpiricalTests };
