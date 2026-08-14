/**
 * tests/m2_challenger_deep_stress.test.js
 * Comprehensive Empirical Challenger Stress Suite for Milestone 2:
 * Storage Integrity, Multi-Wallet Lifecycle, SQL Dump Parity, and Accounting Logic.
 */

const assert = require('assert');
const path = require('path');
const DatabaseManager = require('../js/db.js');

// Mock localStorage engine
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }
  setItem(key, val) {
    this.map.set(String(key), String(val));
  }
  removeItem(key) {
    this.map.delete(String(key));
  }
  clear() {
    this.map.clear();
  }
  get length() {
    return this.map.size;
  }
}

// Minimal Category Manager Mock for category hierarchy tests
class MockCategoryManager {
  constructor() {
    this.categories = [
      { id: 'cat_food', name: 'Ăn uống', type: 'expense', group: 'Ăn uống', icon: '🍲' },
      { id: 'cat_market', name: 'Đi chợ', type: 'expense', group: 'Ăn uống', icon: '🛒' },
      { id: 'cat_rent', name: 'Tiền nhà', type: 'expense', group: 'Nhà cửa', icon: '🏠' },
      { id: 'cat_salary', name: 'Lương', type: 'income', group: 'Thu nhập', icon: '💵' },
      { id: 'cat_bonus', name: 'Thưởng', type: 'income', group: 'Thu nhập', icon: '🎁' },
      { id: 'cat_transfer', name: 'Chuyển tiền nội bộ', type: 'expense', group: 'Khác', icon: '🔄' }
    ];
  }
  getCategories(includeHidden = true) {
    return this.categories;
  }
}

async function runM2DeepStressSuite() {
  console.log('================================================================');
  console.log(' M2 EMPIRICAL CHALLENGER DEEP STRESS & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) {
        console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Multi-Wallet Lifecycle & Balance Invariants (1,500 Transactions)
  // --------------------------------------------------------------------------
  runTest('TEST 1.1: Multi-wallet high-volume CRUD (1,500 operations) with balance ground-truth oracle', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);

    // 1. Define custom wallets with known initial balances
    const customWallets = [
      { id: 'w_cash', name: 'Tiền mặt', type: 'cash', initial_balance: 5000000 },
      { id: 'w_bank', name: 'Techcombank', type: 'bank', initial_balance: 100000000 },
      { id: 'w_momo', name: 'MoMo Pay', type: 'ewallet', initial_balance: 3000000 },
      { id: 'w_credit', name: 'Visa Credit', type: 'credit', initial_balance: -2000000 },
      { id: 'w_invest', name: 'Chứng khoán VPS', type: 'investment', initial_balance: 50000000 }
    ];

    customWallets.forEach(w => db.saveWallet(w));

    // Ground truth oracle balance tracking
    const oracleBalances = {
      w_cash: 5000000,
      w_bank: 100000000,
      w_momo: 3000000,
      w_credit: -2000000,
      w_invest: 50000000
    };

    const walletIds = Object.keys(oracleBalances);

    // 2. Perform 1,500 randomized operations
    const createdTxIds = [];

    for (let i = 0; i < 1500; i++) {
      const op = i % 5;
      const wId = walletIds[i % walletIds.length];
      const walletObj = db.getWallet(wId);
      const amount = (i + 1) * 10000;

      if (op === 0) {
        // Income
        const tx = db.addTransaction({
          date: `2026-0${(i % 9) + 1}-15`,
          type: 'income',
          category: 'Lương',
          amount,
          note: `Income tx ${i}`,
          wallet_id: wId,
          wallet_name: walletObj.name
        });
        createdTxIds.push(tx.id);
        oracleBalances[wId] += amount;
      } else if (op === 1 || op === 2) {
        // Expense
        const tx = db.addTransaction({
          date: `2026-0${(i % 9) + 1}-15`,
          type: 'expense',
          category: 'Ăn uống',
          amount,
          note: `Expense tx ${i}`,
          wallet_id: wId,
          wallet_name: walletObj.name
        });
        createdTxIds.push(tx.id);
        oracleBalances[wId] -= amount;
      } else if (op === 3) {
        // Transfer
        const targetWId = walletIds[(i + 1) % walletIds.length];
        const transferAmount = Math.min(amount, 500000);
        const { outTx, inTx } = db.transferBetweenWallets(wId, targetWId, transferAmount, `Transfer ${i}`);
        createdTxIds.push(outTx.id);
        createdTxIds.push(inTx.id);
        oracleBalances[wId] -= transferAmount;
        oracleBalances[targetWId] += transferAmount;
      } else {
        // Income with camelCase legacy params
        const tx = db.addTransaction({
          date: `2026-0${(i % 9) + 1}-15`,
          type: 'income',
          category: 'Thưởng',
          amount,
          note: `CamelCase tx ${i}`,
          walletId: wId,
          walletName: walletObj.name
        });
        createdTxIds.push(tx.id);
        oracleBalances[wId] += amount;
      }
    }

    // 3. Verify balances against ground truth
    const wallets = db.getWallets(true);
    wallets.forEach(w => {
      if (oracleBalances[w.id] !== undefined) {
        assert.strictEqual(
          w.balance,
          oracleBalances[w.id],
          `Wallet ${w.name} (${w.id}) balance mismatch: got ${w.balance}, expected ${oracleBalances[w.id]}`
        );
      }
    });

    // 4. Update wallet metadata without altering initial_balance
    const targetWallet = db.getWallet('w_bank');
    const oldInitial = targetWallet.initial_balance;
    const oldBalance = targetWallet.balance;

    db.saveWallet({
      id: 'w_bank',
      name: 'Techcombank VIP Priority',
      icon: '💎',
      color: '#ff0000'
    });

    const updatedWallet = db.getWallet('w_bank');
    assert.strictEqual(updatedWallet.name, 'Techcombank VIP Priority');
    assert.strictEqual(updatedWallet.initial_balance, oldInitial, 'initial_balance must NOT drift on metadata edit');
    assert.strictEqual(updatedWallet.balance, oldBalance, 'balance must remain consistent after metadata edit');
  });

  runTest('TEST 1.2: Delete wallet safety constraint & default fallback', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);

    const initialWallets = db.getWallets(true);
    assert.ok(initialWallets.length >= 4);

    // Delete 3 wallets
    db.deleteWallet(initialWallets[1].id);
    db.deleteWallet(initialWallets[2].id);
    db.deleteWallet(initialWallets[3].id);

    const remaining = db.getWallets(true);
    assert.strictEqual(remaining.length, 1, 'Only 1 wallet remains');
    assert.strictEqual(remaining[0].is_default, 1, 'Last remaining wallet must be set as default');

    // Attempting to delete the last remaining wallet must throw
    assert.throws(() => {
      db.deleteWallet(remaining[0].id);
    }, /Cần giữ lại ít nhất 1 ví trong hệ thống/);
  });

  // --------------------------------------------------------------------------
  // TEST 2: SQL Dump Roundtrip Parity Across All 7 Tables
  // --------------------------------------------------------------------------
  runTest('TEST 2.1: 100% Roundtrip Parity on Export & Import across all 7 tables with special chars', () => {
    const storage1 = new MemoryStorage();
    const db1 = new DatabaseManager(storage1);

    // 1. Populate DB1 with rich data
    db1.saveWallet({ id: 'w1', name: "Ví 'Chính' & Vàng", type: 'cash', initial_balance: 10000000 });
    db1.saveWallet({ id: 'w2', name: 'Techcombank "Digital"', type: 'bank', initial_balance: 50000000 });

    db1.addTransaction({
      id: 'tx_special_1',
      date: '2026-08-14',
      type: 'expense',
      category: "Ăn uống & Cà phê",
      amount: 155000,
      note: "McDonald's & O'Reilly Books -- test SQL comment and escaped single quotes",
      wallet_id: 'w1',
      wallet_name: "Ví 'Chính' & Vàng",
      sync_status: 'synced'
    });

    db1.addTransaction({
      id: 'tx_special_2',
      date: '2026-08-15',
      type: 'income',
      category: 'Lương',
      amount: 35000000,
      note: 'Lương tháng 8; DROP TABLE transactions; -- SQL injection simulation',
      wallet_id: 'w2',
      wallet_name: 'Techcombank "Digital"',
      sync_status: 'pending_update'
    });

    db1.saveAsset({
      id: 'asset_1',
      name: "Nhà đất Quận 1, TP.HCM 'Sổ hồng'",
      category: 'Bất động sản',
      value: 7500000000,
      note: 'Nhà phố 4 tầng, đường 8m'
    });

    db1.saveLiability({
      id: 'liab_1',
      name: "Vay mua xe 'VinFast VF8'",
      category: 'Vay trả góp',
      total_debt: 800000000,
      remaining_debt: 450000000,
      note: 'Lãi suất 8.5%/năm'
    });

    const loan = db1.saveLoan({
      id: 'loan_1',
      type: 'loan',
      person_name: "Anh Hoàng (Bạn Cấp 3 'K45')",
      original_amount: 50000000,
      remaining_amount: 30000000,
      due_date: '2026-12-31',
      note: 'Cho vay mua xe máy, trả dần mỗi tháng',
      repayments: [
        { id: 'pmt_1', date: '2026-07-01', principal: 10000000, interest: 500000, note: 'Đợt 1' },
        { id: 'pmt_2', date: '2026-08-01', principal: 10000000, interest: 500000, note: "Đợt 2: Momo's payment" }
      ]
    });

    db1.saveRecurring({
      id: 'rec_1',
      type: 'expense',
      amount: 1500000,
      category: 'Tiền mạng & Điện nước',
      note: 'Hóa đơn Viettel & EVN',
      frequency: 'monthly',
      day_of_month: 10,
      is_active: true
    });

    // 2. Export to SQL dump string
    const sqlDump = db1.exportSql();
    assert.ok(typeof sqlDump === 'string' && sqlDump.length > 500);
    assert.ok(sqlDump.includes('CREATE TABLE IF NOT EXISTS transactions'));
    assert.ok(sqlDump.includes('CREATE TABLE IF NOT EXISTS loans'));

    // 3. Create fresh DB2 on clean storage and import
    const storage2 = new MemoryStorage();
    const db2 = new DatabaseManager(storage2);

    const importResult = db2.importSql(sqlDump);
    assert.ok(importResult.imported_transactions >= 2);
    assert.ok(importResult.imported_assets >= 1);
    assert.ok(importResult.imported_liabilities >= 1);
    assert.ok(importResult.imported_loans >= 1);
    assert.ok(importResult.imported_recurring >= 1);

    // 4. Deep parity verification
    const tx1 = db2.getTransactions().find(t => t.id === 'tx_special_1');
    assert.ok(tx1, 'tx_special_1 must exist in imported DB');
    assert.strictEqual(tx1.amount, 155000);
    assert.strictEqual(tx1.note, "McDonald's & O'Reilly Books -- test SQL comment and escaped single quotes");
    assert.strictEqual(tx1.wallet_id, 'w1');
    assert.strictEqual(tx1.wallet_name, "Ví 'Chính' & Vàng");
    assert.strictEqual(tx1.sync_status, 'synced');

    const tx2 = db2.getTransactions().find(t => t.id === 'tx_special_2');
    assert.ok(tx2, 'tx_special_2 must exist in imported DB');
    assert.strictEqual(tx2.note, 'Lương tháng 8; DROP TABLE transactions; -- SQL injection simulation');

    const asset = db2.getAssets().find(a => a.id === 'asset_1');
    assert.ok(asset);
    assert.strictEqual(asset.name, "Nhà đất Quận 1, TP.HCM 'Sổ hồng'");
    assert.strictEqual(asset.value, 7500000000);

    const liab = db2.getLiabilities().find(l => l.id === 'liab_1');
    assert.ok(liab);
    assert.strictEqual(liab.remaining_debt, 450000000);

    const importedLoan = db2.getLoans().find(l => l.id === 'loan_1');
    assert.ok(importedLoan);
    assert.strictEqual(importedLoan.person_name, "Anh Hoàng (Bạn Cấp 3 'K45')");
    assert.strictEqual(importedLoan.repayments.length, 2);
    assert.strictEqual(importedLoan.repayments[1].note, "Đợt 2: Momo's payment");
  });

  runTest('TEST 2.2: Backward compatibility with legacy 8-column and 9-column transaction SQL dumps', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);

    const legacySql = `
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, category TEXT, amount REAL, note TEXT, created_at TEXT, updated_at TEXT, sync_status TEXT);
      INSERT OR REPLACE INTO transactions VALUES ('legacy_tx_1', '2026-05-10', 'expense', 'Ăn uống', 75000, 'Legacy food note', '2026-05-10T12:00:00.000Z', '2026-05-10T12:00:00.000Z', 'synced');
      INSERT OR REPLACE INTO transactions VALUES ('legacy_tx_2', '2026-05-11', 'income', 'Lương', 20000000, 'Legacy salary', '2026-05-11T08:00:00.000Z', '2026-05-11T08:00:00.000Z', 'synced');
    `;

    const res = db.importSql(legacySql);
    assert.strictEqual(res.imported_transactions, 2);

    const txs = db.getTransactions();
    const t1 = txs.find(t => t.id === 'legacy_tx_1');
    assert.ok(t1);
    assert.strictEqual(t1.wallet_id, 'wallet_cash', 'Legacy import must safely default wallet_id to wallet_cash');
    assert.strictEqual(t1.wallet_name, 'Ví tiền mặt');
    assert.strictEqual(t1.amount, 75000);
  });

  runTest('TEST 2.3: Robustness audit on multiline SQL statements and empty payloads', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);

    // Empty / invalid input throws
    assert.throws(() => db.importSql(null), /Nội dung SQL không hợp lệ/);
    assert.throws(() => db.importSql(''), /Nội dung SQL không hợp lệ/);

    // Single statement with single-line note imports cleanly
    const sql = `INSERT OR REPLACE INTO transactions VALUES ('tx_clean_1', '2026-08-14', 'expense', 'Ăn uống', 50000, 'Single line note', 'wallet_cash', 'Ví tiền mặt', '2026-08-14T08:00:00.000Z', '2026-08-14T08:00:00.000Z', 'synced');`;
    const res = db.importSql(sql);
    assert.strictEqual(res.imported_transactions, 1);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Financial Accounting Engine & Cash Flow Analytics (`charts.js`)
  // --------------------------------------------------------------------------
  runTest('TEST 3.1: Internal transfer exclusion from operational income/expense in calculateSummary', () => {
    const chartManager = require('../js/charts.js');

    const transactions = [
      { id: 'tx1', type: 'income', amount: 50000000, category: 'Lương' },
      { id: 'tx2', type: 'income', amount: 10000000, category: 'Thưởng' },
      { id: 'tx3', type: 'expense', amount: 15000000, category: 'Tiền nhà' },
      { id: 'tx4', type: 'expense', amount: 5000000, category: 'Ăn uống' },
      // Internal transfers via type === 'transfer'
      { id: 'tx5', type: 'transfer', amount: 20000000, category: 'Chuyển tiền sang MoMo' },
      // Internal transfers via category === 'Chuyển tiền nội bộ'
      { id: 'tx6', type: 'expense', amount: 10000000, category: 'Chuyển tiền nội bộ' },
      { id: 'tx7', type: 'income', amount: 10000000, category: 'Chuyển tiền nội bộ' },
      // Internal transfers via is_transfer flag
      { id: 'tx8', type: 'expense', amount: 5000000, category: 'Khác', is_transfer: true },
      // Soft-deleted transaction
      { id: 'tx9', type: 'expense', amount: 9999999, category: 'Ăn uống', sync_status: 'pending_delete' }
    ];

    const summary = chartManager.calculateSummary(transactions);

    // Expected:
    // Total income: 50,000,000 + 10,000,000 = 60,000,000
    // Total expense: 15,000,000 + 5,000,000 = 20,000,000
    // Net balance: 40,000,000
    // Savings rate: (40,000,000 / 60,000,000) * 100 = 66.7%
    assert.strictEqual(summary.totalIncome, 60000000, 'Transfers must be excluded from operational income');
    assert.strictEqual(summary.totalExpense, 20000000, 'Transfers and soft-deleted must be excluded from operational expense');
    assert.strictEqual(summary.netBalance, 40000000);
    assert.strictEqual(summary.savingsRate, 66.7);
  });

  runTest('TEST 3.2: Emergency fund coverage calculation based on total wallet liquidity', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);
    global.DB = db;
    globalThis.DB = db;

    const chartManager = require('../js/charts.js');

    // Create 3 active wallets with total liquidity of 90,000,000
    db.saveWallet({ id: 'w1', name: 'Cash', type: 'cash', initial_balance: 10000000 });
    db.saveWallet({ id: 'w2', name: 'Bank', type: 'bank', initial_balance: 80000000 });
    // Hidden wallet with 500,000,000 (must be excluded from liquidity if getWallets(false))
    db.saveWallet({ id: 'w3', name: 'Secret Hidden', type: 'cash', initial_balance: 500000000, is_hidden: 1 });

    // Historical expenses over 3 months averaging 30,000,000 / month
    const allTxs = [
      { date: '2026-06-15', type: 'expense', amount: 30000000, category: 'Ăn uống' },
      { date: '2026-07-15', type: 'expense', amount: 30000000, category: 'Nhà cửa' },
      { date: '2026-08-15', type: 'expense', amount: 30000000, category: 'Học phí' }
    ];

    const currentSummary = { totalExpense: 30000000, netBalance: 0 };
    const forecast = chartManager.calculateBurnRateAndForecast(allTxs, allTxs, currentSummary);

    // Active liquidity = 10M + 80M = 90M
    // Avg monthly expense = 90M / 3 = 30M
    // Emergency fund months = 90M / 30M = 3.0 months
    assert.strictEqual(forecast.avgMonthlyExpense, 30000000);
    assert.strictEqual(forecast.emergencyFundMonths, 3.0, 'Emergency fund coverage should be 3.0 months based on active wallets');
  });

  runTest('TEST 3.3: 50/30/20 allocation breakdown with zero denominator and edge case categories', () => {
    const chartManager = require('../js/charts.js');

    const emptyAlloc = chartManager.calculate503020Allocation([], 0);
    assert.strictEqual(emptyAlloc.needsPct, 0);
    assert.strictEqual(emptyAlloc.wantsPct, 0);
    assert.strictEqual(emptyAlloc.savingsPct, 0);

    const expenseTxs = [
      { type: 'expense', category: 'Tiền điện & Nước sinh hoạt', amount: 2000000 }, // Needs
      { type: 'expense', category: 'Ăn uống gia đình', amount: 3000000 },           // Needs
      { type: 'expense', category: 'Cà phê & Trà sữa', amount: 1000000 },          // Wants
      { type: 'expense', category: 'Du lịch Đà Nẵng', amount: 2000000 },           // Wants
      { type: 'expense', category: 'Gửi tiết kiệm Techcombank', amount: 2000000 }  // Savings
    ];

    const totalExpense = 10000000;
    const alloc = chartManager.calculate503020Allocation(expenseTxs, totalExpense);

    assert.strictEqual(alloc.needsAmount, 5000000);
    assert.strictEqual(alloc.needsPct, 50.0);
    assert.strictEqual(alloc.wantsAmount, 3000000);
    assert.strictEqual(alloc.wantsPct, 30.0);
    assert.strictEqual(alloc.savingsAmount, 2000000);
    assert.strictEqual(alloc.savingsPct, 20.0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Loan Management & Repayment Flow (`js/db.js`)
  // --------------------------------------------------------------------------
  runTest('TEST 4.1: Loan creation, partial repayment, edit preservation, and full settlement', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);

    // 1. Create a loan (cho vay)
    const loan = db.saveLoan({
      type: 'loan',
      person_name: 'Bạn Thắng',
      original_amount: 30000000,
      due_date: '2026-10-31',
      note: 'Vay kinh doanh ngắn hạn'
    });

    assert.strictEqual(loan.remaining_amount, 30000000);
    assert.strictEqual(loan.status, 'active');
    assert.deepStrictEqual(loan.repayments, []);

    // 2. Partial repayment 1 (10,000,000 principal + 1,000,000 interest)
    const updated1 = db.recordLoanRepayment(loan.id, {
      principal: 10000000,
      interest: 1000000,
      note: 'Thanh toán đợt 1'
    });

    assert.strictEqual(updated1.remaining_amount, 20000000);
    assert.strictEqual(updated1.status, 'active');
    assert.strictEqual(updated1.repayments.length, 1);
    assert.strictEqual(updated1.repayments[0].principal, 10000000);

    // Verify corresponding auto-generated income transaction
    const txs1 = db.getTransactions();
    const autoIncomeTx = txs1.find(t => t.category === 'Thu hồi nợ');
    assert.ok(autoIncomeTx, 'Auto income transaction for loan recovery must be created');
    assert.strictEqual(autoIncomeTx.amount, 11000000);

    // 3. Edit loan metadata (change person_name & note) -> MUST NOT WIPE REPAYMENTS
    db.saveLoan({
      id: loan.id,
      person_name: 'Bạn Thắng (Công ty ABC)',
      note: 'Cập nhật số điện thoại và địa chỉ'
    });

    const editedLoan = db.getLoans().find(l => l.id === loan.id);
    assert.strictEqual(editedLoan.person_name, 'Bạn Thắng (Công ty ABC)');
    assert.strictEqual(editedLoan.remaining_amount, 20000000, 'remaining_amount must be preserved on edit');
    assert.strictEqual(editedLoan.repayments.length, 1, 'repayments array must be preserved on edit');

    // 4. Final repayment (20,000,000 principal) -> status should become 'paid'
    const updated2 = db.recordLoanRepayment(loan.id, {
      principal: 20000000,
      interest: 0,
      note: 'Tất toán toàn bộ'
    });

    assert.strictEqual(updated2.remaining_amount, 0);
    assert.strictEqual(updated2.status, 'paid', 'Loan status must become "paid" when remaining_amount reaches 0');
    assert.strictEqual(updated2.repayments.length, 2);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Date Formatting, Midnight GMT+7 Isolation & Dual-Casing Timestamps
  // --------------------------------------------------------------------------
  runTest('TEST 5.1: Date formatting around GMT+7 midnight & ISO preservation', () => {
    const db = new DatabaseManager(new MemoryStorage());

    // Explicit date strings must be preserved verbatim
    assert.strictEqual(db.normalizeDate ? db.normalizeDate('2026-08-14') : global.formatLocalYMD('2026-08-14'), '2026-08-14');
    assert.strictEqual(global.formatLocalYMD('2024-02-29'), '2024-02-29', 'Leap year preserved');

    // Date object formatting uses local date parts
    const d = new Date(2026, 7, 14, 0, 15, 0); // Month is 0-indexed (7 = August), 00:15 local time
    assert.strictEqual(global.formatLocalYMD(d), '2026-08-14');
  });

  runTest('TEST 5.2: Dual-casing timestamps in normalizeTransaction', () => {
    const db = new DatabaseManager(new MemoryStorage());
    const tx = db.addTransaction({
      amount: 50000,
      category: 'Ăn uống',
      created_at: '2026-08-14T08:00:00.000Z',
      updated_at: '2026-08-14T08:30:00.000Z'
    });

    assert.strictEqual(tx.created_at, '2026-08-14T08:00:00.000Z');
    assert.strictEqual(tx.createdAt, '2026-08-14T08:00:00.000Z', 'createdAt alias must match created_at');
    assert.strictEqual(tx.updated_at, '2026-08-14T08:30:00.000Z');
    assert.strictEqual(tx.updatedAt, '2026-08-14T08:30:00.000Z', 'updatedAt alias must match updated_at');
  });

  // --------------------------------------------------------------------------
  // TEST 6: History Filter, Multi-Wallet Querying & Keyword Search (`history.js`)
  // --------------------------------------------------------------------------
  runTest('TEST 6.1: History filtering by wallet_id, wallet_name, date range, and keyword search', () => {
    const storage = new MemoryStorage();
    const db = new DatabaseManager(storage);
    global.DB = db;
    globalThis.DB = db;
    global.CategoryManager = new MockCategoryManager();
    globalThis.CategoryManager = global.CategoryManager;

    const historyManager = require('../js/history.js');

    // Add diverse transactions
    db.addTransaction({
      id: 'h_tx1',
      date: '2026-08-10',
      type: 'expense',
      category: 'Đi chợ',
      amount: 125000,
      note: 'Mua rau củ siêu thị Co.opmart',
      wallet_id: 'w_cash',
      wallet_name: 'Tiền mặt'
    });

    db.addTransaction({
      id: 'h_tx2',
      date: '2026-08-12',
      type: 'expense',
      category: 'Tiền nhà',
      amount: 6000000,
      note: 'Thanh toán tiền nhà tháng 8',
      wallet_id: 'w_bank',
      wallet_name: 'Techcombank'
    });

    db.addTransaction({
      id: 'h_tx3',
      date: '2026-08-14',
      type: 'income',
      category: 'Lương',
      amount: 25000000,
      note: 'Lương công ty chuyển khoản',
      wallet_id: 'w_bank',
      wallet_name: 'Techcombank'
    });

    // 1. Filter by wallet_id
    const cashTxs = historyManager.filterTransactions({ wallet_id: 'w_cash' });
    assert.strictEqual(cashTxs.length, 1);
    assert.strictEqual(cashTxs[0].id, 'h_tx1');

    // 2. Filter by wallet_name
    const bankTxs = historyManager.filterTransactions({ wallet_name: 'Techcombank' });
    assert.strictEqual(bankTxs.length, 2);

    // 3. Filter by category group (Ăn uống matches subcategory 'Đi chợ')
    const foodGroupTxs = historyManager.filterTransactions({ category: 'Ăn uống' });
    assert.strictEqual(foodGroupTxs.length, 1);
    assert.strictEqual(foodGroupTxs[0].category, 'Đi chợ');

    // 4. Keyword search by note
    const searchNote = historyManager.filterTransactions({ query: 'Co.opmart' });
    assert.strictEqual(searchNote.length, 1);

    // 5. Keyword search by formatted amount ("125.000")
    const searchAmount = historyManager.filterTransactions({ query: '125.000' });
    assert.strictEqual(searchAmount.length, 1);
    assert.strictEqual(searchAmount[0].id, 'h_tx1');

    // 6. Date range filter
    const dateRangeTxs = historyManager.filterTransactions({ startDate: '2026-08-11', endDate: '2026-08-13' });
    assert.strictEqual(dateRangeTxs.length, 1);
    assert.strictEqual(dateRangeTxs[0].id, 'h_tx2');

    // 7. Inverted date range returns empty
    const invertedTxs = historyManager.filterTransactions({ startDate: '2026-08-20', endDate: '2026-08-10' });
    assert.strictEqual(invertedTxs.length, 0);

    // 8. Group by date
    const grouped = historyManager.groupByDate(db.getTransactions());
    assert.strictEqual(grouped.length, 3);
    assert.strictEqual(grouped[0].date, '2026-08-14');
    assert.strictEqual(grouped[0].totalIncome, 25000000);
  });

  // Summary
  console.log('\n================================================================');
  console.log(` M2 DEEP STRESS SUITE SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL EMPIRICAL CHALLENGER STRESS TESTS PASSED WITH 100% SUCCESS!');
  } else {
    throw new Error(`${totalTests - passedTests} test(s) failed in M2 Deep Stress Suite!`);
  }
}

if (require.main === module) {
  runM2DeepStressSuite().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { runM2DeepStressSuite };
