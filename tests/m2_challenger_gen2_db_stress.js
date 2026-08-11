/**
 * tests/m2_challenger_gen2_db_stress.js
 * Dedicated Empirical Stress Test Suite for js/db.js & Transaction Persistence
 * Challenger 1 (Re-attempt) Milestone M2
 */

const path = require('path');
const { TestAssert, TestEnvironment, runTestCase } = require('./test-utils');

async function runGen2DbStressSuite(projectRoot = path.resolve(__dirname, '..')) {
  const results = [];

  console.log('================================================================');
  console.log(' M2 CHALLENGER GEN2: DB.JS & TRANSACTION PERSISTENCE STRESS SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: High Volume CRUD Operations (1,500+ Transactions)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('GEN2-DB-1', 'High Volume CRUD: 1,500 transactions creation, retrieval, filtering, update & deletion', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    const startTime = Date.now();
    const categories = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn', 'Giải trí', 'Lương', 'Thưởng'];

    // Add 1,500 transactions sequentially via DB.addTransaction
    const createdIds = [];
    for (let i = 0; i < 1500; i++) {
      const type = i % 4 === 0 ? 'income' : 'expense';
      const cat = categories[i % categories.length];
      const tx = env.db.addTransaction({
        date: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
        type: type,
        category: cat,
        amount: (i + 1) * 5000,
        note: `Stress item #${i} - ${cat}`
      });
      createdIds.push(tx.id);
    }
    const addTime = Date.now() - startTime;

    // Retrieve all
    const fetchStart = Date.now();
    const all = env.db.getTransactions();
    const fetchTime = Date.now() - fetchStart;

    TestAssert.equal(all.length, 1500, 'All 1,500 transactions must be retrieved');

    // Filter by type, category, date range, keyword
    const expenseOnly = env.db.getTransactions({ type: 'expense' });
    TestAssert.equal(expenseOnly.length, 1125, '3/4 of 1500 = 1125 expenses');

    const foodOnly = env.db.getTransactions({ category: 'Ăn uống' });
    TestAssert.isTrue(foodOnly.length > 0, 'Food transactions found');

    const dateFiltered = env.db.getTransactions({ startDate: '2026-03-01', endDate: '2026-05-31' });
    TestAssert.isTrue(dateFiltered.length > 0, 'Date filtered transactions found');

    const searchFiltered = env.db.getTransactions({ keyword: 'item #500' });
    TestAssert.equal(searchFiltered.length, 1, 'Exact keyword search found item #500');

    // Update operation on 100 items
    const updateStart = Date.now();
    for (let i = 0; i < 100; i++) {
      env.db.updateTransaction(createdIds[i], { amount: 999999, note: `Updated note #${i}` });
    }
    const updateTime = Date.now() - updateStart;

    // Delete operation (50 hard delete unsynced, 50 soft delete synced)
    for (let i = 0; i < 50; i++) {
      env.db.deleteTransaction(createdIds[i]); // pending_add -> hard delete
    }
    for (let i = 50; i < 100; i++) {
      env.db.updateTransaction(createdIds[i], { sync_status: 'synced' });
      env.db.deleteTransaction(createdIds[i]); // synced -> soft delete (pending_delete)
    }

    const defaultFetch = env.db.getTransactions();
    TestAssert.equal(defaultFetch.length, 1400, 'Default getTransactions() excludes soft-deleted items (1400 items)');

    const withDeleted = env.db.getTransactions({ includeDeleted: true });
    TestAssert.equal(withDeleted.length, 1450, 'getTransactions({ includeDeleted: true }) includes soft-deleted items (1450 items)');

    const rawStored = JSON.parse(env.localStorage.getItem('stc_transactions'));
    TestAssert.equal(rawStored.length, 1450, '1500 - 50 hard deleted = 1450 total stored in localStorage (including 50 soft deleted)');

    console.log(`   ⏱️ High Volume Metrics: 1,500 adds in ${addTime}ms, load in ${fetchTime}ms, 100 updates in ${updateTime}ms`);
  }));

  // --------------------------------------------------------------------------
  // TEST 2: Invalid & Boundary Inputs
  // --------------------------------------------------------------------------
  results.push(await runTestCase('GEN2-DB-2', 'Invalid & Boundary Inputs: NaN, negative, string, zero, 1e15+, empty fields, XSS payloads', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // 1. NaN amounts
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: NaN, category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Must reject NaN amount');

    // 2. Negative amounts
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: -500, category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Must reject negative amount');

    // 3. String non-numeric amounts
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 'NOT_A_NUMBER', category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Must reject string non-numeric amount');

    // 4. Zero amount
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 0, category: 'Ăn uống' });
    }, /Số tiền phải là số dương hợp lệ/, 'Must reject zero amount');

    // 5. String valid numeric amount (e.g. "50000")
    const txStr = env.db.addTransaction({ amount: '50000', category: 'Ăn uống' });
    TestAssert.equal(txStr.amount, 50000, 'String numeric amount "50000" converted to number 50000');

    // 6. Extremely large numbers (1e15+)
    const hugeAmount = 1e15; // 1,000,000,000,000,000
    const txHuge = env.db.addTransaction({ amount: hugeAmount, category: 'Lương' });
    TestAssert.equal(txHuge.amount, 1e15, 'Extremely large amount 1e15 stored accurately');
    const formattedHuge = env.db.formatVND(txHuge.amount);
    TestAssert.equal(formattedHuge, '1.000.000.000.000.000 ₫', '1e15 formatted correctly to VND string with dots');

    // 7. Empty & null fields
    const txDefaults = env.db.addTransaction({ amount: 10000, category: '', note: null, date: null, type: 'expense' });
    TestAssert.equal(txDefaults.category, 'Ăn uống', 'Empty expense category defaults to Ăn uống');
    TestAssert.equal(txDefaults.note, '', 'Null note converted to empty string');
    TestAssert.equal(txDefaults.date, new Date().toISOString().split('T')[0], 'Null date defaults to today YYYY-MM-DD');

    const txIncomeDefaults = env.db.addTransaction({ amount: 10000, category: null, type: 'income' });
    TestAssert.equal(txIncomeDefaults.category, 'Lương', 'Null income category defaults to Lương');

    // 8. XSS payloads in note fields
    const xssPayload = '<script>alert("XSS_DB")</script><img src=x onerror=alert(1)>';
    const txXSS = env.db.addTransaction({ amount: 20000, note: xssPayload });
    TestAssert.equal(txXSS.note, xssPayload, 'XSS string stored verbatim without corrupting DB');

    // 9. Search filter with XSS keyword
    const searchXSS = env.db.getTransactions({ keyword: '<script>' });
    TestAssert.equal(searchXSS.length, 1, 'Search query handles special HTML/XSS chars safely');
  }));

  // --------------------------------------------------------------------------
  // TEST 3: Date Edge Cases
  // --------------------------------------------------------------------------
  results.push(await runTestCase('GEN2-DB-3', 'Date Edge Cases: invalid date strings, leap years, timezone ISO boundaries', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // 1. Valid Leap Year Date (2024-02-29)
    const txLeap = env.db.addTransaction({ amount: 10000, date: '2024-02-29', category: 'Ăn uống' });
    TestAssert.equal(txLeap.date, '2024-02-29', 'Leap year date 2024-02-29 handled correctly');

    // 2. Non-leap Year Date string (2026-02-28)
    const txFEB = env.db.addTransaction({ amount: 15000, date: '2026-02-28', category: 'Ăn uống' });
    TestAssert.equal(txFEB.date, '2026-02-28', '2026-02-28 date string handled correctly');

    // 3. Timezone ISO Boundary strings
    const isoDate1 = '2026-12-31T23:59:59.999Z';
    const txISO = env.db.addTransaction({ amount: 20000, date: isoDate1, category: 'Hóa đơn' });
    TestAssert.equal(txISO.date, isoDate1, 'Full ISO timestamp string stored intact');

    // 4. Invalid Date Strings (e.g. "invalid-date", "9999-99-99")
    const txInvalidDate = env.db.addTransaction({ amount: 30000, date: 'invalid-date-string' });
    TestAssert.equal(txInvalidDate.date, 'invalid-date-string', 'Invalid date string preserved without throwing crash');

    // 5. Date filtering with date boundaries
    const filteredLeap = env.db.getTransactions({ startDate: '2024-02-01', endDate: '2024-02-29' });
    TestAssert.isTrue(filteredLeap.some(t => t.id === txLeap.id), 'Leap year transaction included in date range filter');
  }));

  // --------------------------------------------------------------------------
  // TEST 4: Storage Resilience
  // --------------------------------------------------------------------------
  results.push(await runTestCase('GEN2-DB-4', 'Storage Resilience: corrupted JSON string, QuotaExceededError, missing/throwing localStorage', async () => {
    const env = new TestEnvironment(projectRoot);

    // 1. Corrupted JSON string in LocalStorage
    env.localStorage.setItem('stc_transactions', '{ TRUNCATED_JSON_DATA: [');
    env.loadSourceFiles();

    let txs = env.db.getTransactions();
    TestAssert.deepEqual(txs, [], 'Corrupted JSON in localStorage falls back safely to [] without crashing');

    // 2. QuotaExceededError handling
    env.localStorage.throwQuotaError = true;
    TestAssert.throws(() => {
      env.db.addTransaction({ amount: 50000, category: 'Ăn uống' });
    }, /Quota Exceeded|Dung lượng lưu trữ trình duyệt đã đầy/i, 'addTransaction catches QuotaExceededError and throws descriptive Vietnamese error');

    TestAssert.throws(() => {
      env.db.saveTransactions([{ id: 'tx_1', amount: 1000 }]);
    }, /Quota Exceeded|Dung lượng lưu trữ trình duyệt đã đầy/i, 'saveTransactions propagates descriptive quota error');

    // 4. Missing/Disabled localStorage resilience (when DB storage getter returns null or throws on access)
    if (env.window) delete env.window.localStorage;
    if (env.context) delete env.context.localStorage;
    const DatabaseManagerClass = env.db.constructor;
    const nullStorageDb = new DatabaseManagerClass(null);
    TestAssert.equal(nullStorageDb.storage, null, 'Storage is null when localStorage is undefined');
    TestAssert.deepEqual(nullStorageDb.getTransactions(), [], 'getTransactions returns [] when storage is null');
    TestAssert.doesNotThrow(() => {
      nullStorageDb.saveTransactions([{ id: 't1', amount: 100 }]);
    }, 'saveTransactions degrades gracefully when storage is null');
  }));

  // --------------------------------------------------------------------------
  // TEST 5: Casing Compatibility (createdAt / created_at, updatedAt / updated_at)
  // --------------------------------------------------------------------------
  results.push(await runTestCase('GEN2-DB-5', 'Casing Compatibility: verify access to both createdAt and created_at, updatedAt and updated_at', async () => {
    const env = new TestEnvironment(projectRoot);
    env.loadSourceFiles();

    // Case 1: Add new transaction
    const tx1 = env.db.addTransaction({ amount: 100000, category: 'Lương', type: 'income' });
    TestAssert.isOk(tx1.created_at, 'created_at present');
    TestAssert.isOk(tx1.createdAt, 'createdAt present');
    TestAssert.equal(tx1.created_at, tx1.createdAt, 'createdAt and created_at must be identical');
    TestAssert.isOk(tx1.updated_at, 'updated_at present');
    TestAssert.isOk(tx1.updatedAt, 'updatedAt present');
    TestAssert.equal(tx1.updated_at, tx1.updatedAt, 'updatedAt and updated_at must be identical');

    // Case 2: Import legacy/external object with ONLY camelCase (createdAt, updatedAt)
    const camelTx = {
      id: 'tx_camel_123',
      date: '2026-08-10',
      type: 'expense',
      category: 'Ăn uống',
      amount: 45000,
      note: 'CamelCase test',
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T11:00:00.000Z',
      sync_status: 'synced'
    };

    env.db.saveTransactions([camelTx]);
    const loadedCamel = env.db.getTransactions();
    TestAssert.equal(loadedCamel.length, 1);
    TestAssert.equal(loadedCamel[0].createdAt, '2026-08-10T10:00:00.000Z', 'createdAt preserved');
    TestAssert.equal(loadedCamel[0].created_at, '2026-08-10T10:00:00.000Z', 'created_at mapped from createdAt');
    TestAssert.equal(loadedCamel[0].updatedAt, '2026-08-10T11:00:00.000Z', 'updatedAt preserved');
    TestAssert.equal(loadedCamel[0].updated_at, '2026-08-10T11:00:00.000Z', 'updated_at mapped from updatedAt');

    // Case 3: Import object with ONLY snake_case (created_at, updated_at)
    const snakeTx = {
      id: 'tx_snake_456',
      date: '2026-08-10',
      type: 'income',
      category: 'Thưởng',
      amount: 200000,
      note: 'SnakeCase test',
      created_at: '2026-08-10T12:00:00.000Z',
      updated_at: '2026-08-10T13:00:00.000Z',
      sync_status: 'synced'
    };

    env.db.saveTransactions([snakeTx]);
    const loadedSnake = env.db.getTransactions();
    TestAssert.equal(loadedSnake.length, 1);
    TestAssert.equal(loadedSnake[0].created_at, '2026-08-10T12:00:00.000Z', 'created_at preserved');
    TestAssert.equal(loadedSnake[0].createdAt, '2026-08-10T12:00:00.000Z', 'createdAt mapped from created_at');
    TestAssert.equal(loadedSnake[0].updated_at, '2026-08-10T13:00:00.000Z', 'updated_at preserved');
    TestAssert.equal(loadedSnake[0].updatedAt, '2026-08-10T13:00:00.000Z', 'updatedAt mapped from updated_at');

    // Case 4: Update transaction and verify both casing fields get updated
    const updatedSnake = env.db.updateTransaction('tx_snake_456', { amount: 250000 });
    TestAssert.equal(updatedSnake.updated_at, updatedSnake.updatedAt, 'Both updated_at and updatedAt reflect newest timestamp on update');
  }));

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` GEN2 DB STRESS TEST SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`❌ GEN2 DB STRESS TESTS FAILED: ${failed} tests failed!`);
    results.filter(r => !r.passed).forEach(r => {
      console.error(`\n  - [FAIL] ${r.id} - ${r.title}:`);
      console.error(`    ${r.error.stack || r.error.message || r.error}`);
    });
  } else {
    console.log('✅ ALL GEN2 DB STRESS & PERSISTENCE TESTS PASSED SUCCESSFULLY!');
  }

  return results;
}

if (require.main === module) {
  runGen2DbStressSuite().then(results => {
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runGen2DbStressSuite };
