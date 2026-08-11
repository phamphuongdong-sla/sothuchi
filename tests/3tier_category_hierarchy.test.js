/**
 * 3-Tier Category Hierarchy & Custom Category System Verification Tests
 */

const path = require('path');
const fs = require('fs');
const { TestEnvironment, TestAssert, runTestCase } = require('./test-utils');

const projectRoot = path.resolve(__dirname, '..');

async function run3TierCategoryTests() {
  console.log('\n================================================================');
  console.log(' 3-TIER CATEGORY HIERARCHY VERIFICATION SUITE');
  console.log('================================================================\n');

  const results = [];

  // Test 1: Verify 15 Default Groups & 92 Subcategories
  results.push(await runTestCase('CAT-3T-01', 'Verify 15 Default Groups and Subcategory Mapping', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();
    TestAssert.isOk(localEnv.context.CategoryManager, 'CategoryManager must be loaded');

    const groups = localEnv.context.CategoryManager.getGroups();
    TestAssert.equal(groups.length, 15, 'Must have 15 standard category groups');

    const expenseGroups = localEnv.context.CategoryManager.getGroups('expense');
    TestAssert.equal(expenseGroups.length, 14, 'Must have 14 expense category groups');

    const incomeGroups = localEnv.context.CategoryManager.getGroups('income');
    TestAssert.equal(incomeGroups.length, 1, 'Must have 1 income category group');

    const allCats = localEnv.context.CategoryManager.getCategories();
    TestAssert.isTrue(allCats.length >= 90, 'Must have ~92 default subcategories');
  }));

  // Test 2: Add Custom Main Group (Tier 2)
  results.push(await runTestCase('CAT-3T-02', 'Add Custom Main Group', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();

    const newGroup = localEnv.context.CategoryManager.addGroup({
      name: 'Đầu tư tài chính',
      type: 'expense',
      icon: '📈',
      color: '#f59e0b'
    });

    TestAssert.isOk(newGroup, 'New group object must be returned');
    TestAssert.equal(newGroup.name, 'Đầu tư tài chính');
    TestAssert.equal(newGroup.type, 'expense');

    const groups = localEnv.context.CategoryManager.getGroups('expense');
    TestAssert.isTrue(groups.some(g => g.name === 'Đầu tư tài chính'), 'Custom group must exist in groups list');
  }));

  // Test 3: Add Custom Subcategory under Custom Main Group (Tier 3)
  results.push(await runTestCase('CAT-3T-03', 'Add Custom Subcategory under Group', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();

    localEnv.context.CategoryManager.addGroup({
      name: 'Dự phòng',
      type: 'expense',
      icon: '🛡️'
    });

    const newSubcat = localEnv.context.CategoryManager.addCategory({
      name: 'Quỹ khẩn cấp',
      group: 'Dự phòng',
      type: 'expense',
      icon: '🏦'
    });

    TestAssert.isOk(newSubcat, 'New subcategory object must be returned');
    TestAssert.equal(newSubcat.name, 'Quỹ khẩn cấp');
    TestAssert.equal(newSubcat.group, 'Dự phòng');

    const subcatsInGroup = localEnv.context.CategoryManager.getByGroup('Dự phòng');
    TestAssert.equal(subcatsInGroup.length, 1);
    TestAssert.equal(subcatsInGroup[0].name, 'Quỹ khẩn cấp');
  }));

  // Test 4: Form Category Select Optgroup Population
  results.push(await runTestCase('CAT-3T-04', 'Transaction Form Optgroup Dropdown Population', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();

    localEnv.context.TransactionForm.populateCategories('expense');
    const selectEl = localEnv.document.getElementById('input-category');
    TestAssert.isOk(selectEl, 'input-category select element must exist');

    const optgroups = selectEl.querySelectorAll('optgroup');
    TestAssert.isTrue(optgroups.length > 0, 'Category dropdown must render optgroup elements for 3-tier hierarchy');
  }));

  // Test 5: Filter Transactions by Group Name
  results.push(await runTestCase('CAT-3T-05', 'Filter History Transactions by Group Name', async () => {
    const localEnv = new TestEnvironment(projectRoot);
    localEnv.loadSourceFiles();

    localEnv.context.DB.addTransaction({ amount: 50000, category: 'Đi chợ', date: '2026-08-11' });
    localEnv.context.DB.addTransaction({ amount: 120000, category: 'Siêu thị', date: '2026-08-11' });
    localEnv.context.DB.addTransaction({ amount: 300000, category: 'Khám bệnh', date: '2026-08-11' });

    const filtered = localEnv.context.HistoryManager.filterTransactions({ category: '1. Ăn uống' });
    TestAssert.equal(filtered.length, 2, 'Filtering by group name "1. Ăn uống" must return all subcategory transactions under that group');
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(` 3-TIER CATEGORY VERIFICATION SUMMARY: ${passed} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} 3-tier category verification tests failed.`);
  }

  return results;
}

if (require.main === module) {
  run3TierCategoryTests().catch(err => {
    console.error('3-Tier Category verification test runner failed:', err);
    process.exit(1);
  });
}

module.exports = { run3TierCategoryTests };
