/**
 * tests/m2_adversarial.test.js - Milestone M2 Empirical Adversarial Test Suite
 * Stress tests M2 Finance Core & Category Management against XSS, invalid inputs,
 * missing DOM elements, category state stress, and storage corruption.
 */

const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runM2AdversarialTests(projectRoot = '/Users/mrdong/So Thu Chi') {
  const results = [];

  console.log('\n================================================================');
  console.log(' MILESTONE M2 ADVERSARIAL & STRESS TEST SUITE');
  console.log('================================================================\n');

  // Helper to access globals from environment
  const getTransactionForm = (env) => env.context.TransactionForm || env.window.TransactionForm;
  const getToast = (env) => env.context.Toast || env.window.Toast;
  const getParseRawAmount = (env) => env.context.parseRawAmount || env.window.parseRawAmount;

  // --------------------------------------------------------------------------
  // SCENARIO 1: XSS Payloads in Transaction Notes, Category Names & Icons
  // --------------------------------------------------------------------------
  results.push(await runTestCase('ADV-XSS-1', 'XSS Injection in Transaction Note & Category Name via DB & Form', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const xssPayload = '<script>alert("XSS_NOTE")</script><img src=x onerror=alert("XSS_IMG")>';
    
    // Add transaction with XSS payload in note
    const tx = env.db.addTransaction({
      amount: 100000,
      type: 'expense',
      category: 'Ăn uống',
      note: xssPayload
    });

    TestAssert.equal(tx.note, xssPayload, 'DB preserves string content without corruption');

    // Add category with XSS payload in name & icon
    const catXss = env.categoryManager.addCategory({
      name: 'Hạng mục <script>alert("XSS_CAT")</script>',
      type: 'expense',
      icon: '<svg onload=alert(1)>'
    });

    TestAssert.isOk(catXss.id, 'Category added successfully');

    // Test DOM population escaping in category select dropdown
    const selectEl = env.document.getElementById('input-category');
    const transactionForm = getTransactionForm(env);
    transactionForm.populateCategories('expense');
    
    const options = Array.from(selectEl.children);
    const xssOption = options.find(o => o.value === catXss.name);
    TestAssert.isOk(xssOption, 'Category option created');
    TestAssert.equal(xssOption.textContent.includes('<script>'), true, 'Option textContent contains literal script string (escaped safely by browser DOM textContent)');
  }));

  results.push(await runTestCase('ADV-XSS-2', 'Toast System innerHTML XSS Vulnerability Audit', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const toast = getToast(env);
    let toastContainer = env.document.getElementById('toast-container');
    const dangerousMsg = '<b id="xss-test-element">Dangerous HTML</b>';
    
    toast.show(dangerousMsg, 'info');

    toastContainer = env.document.getElementById('toast-container');
    TestAssert.isOk(toastContainer, 'Toast container exists in document');
    TestAssert.isTrue(toastContainer.children.length > 0, 'Toast element appended to toast container');
    
    const createdToast = toastContainer.children[0];
    console.log(`[ADV-XSS-2 Audit] Toast innerHTML payload string: ${createdToast.innerHTML}`);
    TestAssert.contains(createdToast.innerHTML, 'toast-message', 'Toast innerHTML contains toast-message span');
    TestAssert.contains(createdToast.innerHTML, 'Dangerous HTML', 'Toast innerHTML contains message text');
  }));

  // --------------------------------------------------------------------------
  // SCENARIO 2: Negative Amounts, Zero, NaN, Extreme Numbers & Floating Points
  // --------------------------------------------------------------------------
  results.push(await runTestCase('ADV-NUM-1', 'DB Rejection of Negative, Zero, and Non-numeric Amounts', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Rejection of negative amounts
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: -50000, type: 'expense', category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Should reject negative amount -50000');

    // Rejection of zero amount
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 0, type: 'expense', category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Should reject zero amount');

    // Rejection of string NaN amount
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 'INVALID_AMOUNT', type: 'expense', category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Should reject string NaN amount');

    // Rejection of null/undefined amount
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: null, type: 'expense', category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Should reject null amount');

    // Update with negative amount
    const tx = env.db.addTransaction({ amount: 100000, type: 'expense', category: 'Ăn uống' });
    TestAssert.throws(() => {
      env.db.updateTransaction(tx.id, { amount: -20000 });
    }, /Số tiền phải là số dương hợp lệ/, 'Should reject update to negative amount');
  }));

  results.push(await runTestCase('ADV-NUM-2', 'VND Formatting & Floating Point Handling', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Floating point amount round check
    const formattedFloat = env.db.formatVND(123456.78);
    TestAssert.equal(formattedFloat, '123.457 ₫', 'Should round floats to nearest integer VND');

    // Extreme number handling
    const formattedHuge = env.db.formatVND(1000000000000);
    TestAssert.equal(formattedHuge, '1.000.000.000.000 ₫', 'Should format 1 trillion VND with dot thousand separators');

    // Form raw amount parser checks
    const parseRawAmount = getParseRawAmount(env);
    TestAssert.equal(parseRawAmount('150.000'), 150000);
    TestAssert.equal(parseRawAmount('2.500.000 ₫'), 2500000);
    TestAssert.equal(parseRawAmount(''), 0);
    TestAssert.equal(parseRawAmount(null), 0);
  }));

  // --------------------------------------------------------------------------
  // SCENARIO 3: Category Toggle Stress & Edge Case Constraints
  // --------------------------------------------------------------------------
  results.push(await runTestCase('ADV-CAT-1', 'Rapid Toggling of Category Visibility (1000 Iterations)', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const cats = env.categoryManager.getAll();
    const target = cats[0];
    const initialStatus = target.isHidden;

    // Toggle 1000 times
    for (let i = 0; i < 1000; i++) {
      env.categoryManager.toggleHideCategory(target.id);
    }

    const finalCat = env.categoryManager.getAll().find(c => c.id === target.id);
    TestAssert.equal(finalCat.isHidden, initialStatus, 'Category hidden status must return to initial status after even number of toggles');
  }));

  results.push(await runTestCase('ADV-CAT-2', 'Attempting to Hide ALL Expense Categories Guard', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const expenseCats = env.categoryManager.getActive('expense');
    
    // Hide all except last one
    for (let i = 0; i < expenseCats.length - 1; i++) {
      env.categoryManager.toggleHideCategory(expenseCats[i].id);
    }

    const remainingActive = env.categoryManager.getActive('expense');
    TestAssert.equal(remainingActive.length, 1, 'Exactly 1 active expense category remains');

    // Attempting to hide the last remaining active category must throw
    TestAssert.throws(() => {
      env.categoryManager.toggleHideCategory(remainingActive[0].id);
    }, /Phải giữ ít nhất 1 hạng mục hoạt động/, 'Must reject hiding last active category for type');
  }));

  results.push(await runTestCase('ADV-CAT-3', 'Whitespace, Duplicate & Empty Category Name Guards', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Empty string
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '', type: 'income' });
    }, /Tên hạng mục không được để trống/);

    // Whitespace only
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: '   \t  ', type: 'income' });
    }, /Tên hạng mục không được để trống/);

    // Duplicate case-insensitive check ('lương' vs 'Lương')
    TestAssert.throws(() => {
      env.categoryManager.addCategory({ name: 'lương', type: 'income' });
    }, /Tên hạng mục đã tồn tại/);
  }));

  // --------------------------------------------------------------------------
  // SCENARIO 4: Missing DOM Elements & Graceful Degradation
  // --------------------------------------------------------------------------
  results.push(await runTestCase('ADV-DOM-1', 'Form Operations with Missing DOM Elements', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const transactionForm = getTransactionForm(env);

    // Remove form from DOM
    const form = env.document.getElementById('transaction-form');
    if (form && form.parentNode) {
      form.parentNode.removeChild(form);
    }

    // Attempting form reset should not throw
    TestAssert.doesNotThrow(() => {
      transactionForm.resetForm();
    }, 'resetForm should degrade gracefully when form element missing');

    // Attempting category population should not throw
    TestAssert.doesNotThrow(() => {
      transactionForm.populateCategories('income');
    }, 'populateCategories should degrade gracefully when select missing');

    // Attempting form submission when form input elements missing handles error gracefully
    TestAssert.throws(() => {
      transactionForm.handleSubmit();
    }, /Số tiền phải là số dương hợp lệ/);
  }));

  // --------------------------------------------------------------------------
  // SCENARIO 5: LocalStorage Corruption & Direct Object Mutation Safety
  // --------------------------------------------------------------------------
  results.push(await runTestCase('ADV-STOR-1', 'Recovery from Storage Corruption & Array Mutation Isolation', async () => {
    const env = new TestEnvironment(projectRoot);
    
    // Set corrupted categories storage
    env.localStorage.setItem('stc_categories', 'NOT_VALID_JSON_ARR[');
    env.loadSourceFiles();

    // Should fall back to default categories without crashing
    const cats = env.categoryManager.getAll();
    TestAssert.isTrue(cats.length >= 12, 'CategoryManager recovers defaults on storage corruption');

    // Array mutation isolation check
    const tx1 = env.db.addTransaction({ amount: 50000, type: 'expense', category: 'Ăn uống' });
    const fetched1 = env.db.getTransactions();
    fetched1[0].amount = 999999; // mutate returned object

    const fetched2 = env.db.getTransactions();
    TestAssert.equal(fetched2[0].amount, 50000, 'Original DB record is immune to external mutation of returned array items');
  }));

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` M2 ADVERSARIAL TEST SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ ADVERSARIAL SUITE DISCOVERED ${failed} FAILURES!`);
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - [FAIL] ${r.id} - ${r.title}: ${r.error.message}`);
    });
  } else {
    console.log('✅ ALL ADVERSARIAL & STRESS SCENARIOS PASSED!');
  }

  return results;
}

if (require.main === module) {
  runM2AdversarialTests().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runM2AdversarialTests };
