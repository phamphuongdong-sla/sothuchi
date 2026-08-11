/**
 * run-all-tests.js - Main E2E Test Suite Runner for Sổ Thu Chi Cá Nhân
 * Executes all 126 test cases across Tier 1, Tier 2, Tier 3, and Tier 4.
 */

const path = require('path');
const { runTier1Tests } = require('./tier1_features.test');
const { runTier2Tests } = require('./tier2_boundaries.test');
const { runTier3Tests } = require('./tier3_pairwise.test');
const { runTier4Tests } = require('./tier4_scenarios.test');
const { runM3VerificationTests } = require('./m3_verification.test');
const { run3TierCategoryTests } = require('./3tier_category_hierarchy.test');
const { runDeletionSyncTests } = require('./deletion_sync.test');
const { runSyncPerformanceTests } = require('./sync_performance.test');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const startTime = Date.now();

  console.log('================================================================');
  console.log(' SỔ THU CHI CÁ NHÂN (PWA) - E2E TEST SUITE RUNNER');
  console.log('================================================================');
  console.log(`Project Root: ${projectRoot}`);
  console.log(`Execution Time: ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  // --------------------------------------------------------------------------
  // TIER 1: Feature Coverage Tests (55 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [TIER 1] Feature Coverage Tests (F1.1-F1.5 to F11.1-F11.5)...');
  const tier1Results = await runTier1Tests(projectRoot);
  let tier1Passed = 0;
  tier1Results.forEach(r => {
    totalTests++;
    if (r.passed) {
      tier1Passed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Tier 1 Summary: ${tier1Passed}/${tier1Results.length} passed.\n`);

  // --------------------------------------------------------------------------
  // TIER 2: Boundary & Corner Cases (55 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [TIER 2] Boundary & Corner Cases (F1.B1-F1.B5 to F11.B1-F11.B5)...');
  const tier2Results = await runTier2Tests(projectRoot);
  let tier2Passed = 0;
  tier2Results.forEach(r => {
    totalTests++;
    if (r.passed) {
      tier2Passed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Tier 2 Summary: ${tier2Passed}/${tier2Results.length} passed.\n`);

  // --------------------------------------------------------------------------
  // TIER 3: Cross-Feature Pairwise Interactions (11 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [TIER 3] Cross-Feature Pairwise Interactions (P1 to P11)...');
  const tier3Results = await runTier3Tests(projectRoot);
  let tier3Passed = 0;
  tier3Results.forEach(r => {
    totalTests++;
    if (r.passed) {
      tier3Passed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Tier 3 Summary: ${tier3Passed}/${tier3Results.length} passed.\n`);

  // --------------------------------------------------------------------------
  // TIER 4: Real-World Application Scenarios (5 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [TIER 4] Real-World Application Scenarios (S1 to S5)...');
  const tier4Results = await runTier4Tests(projectRoot);
  let tier4Passed = 0;
  tier4Results.forEach(r => {
    totalTests++;
    if (r.passed) {
      tier4Passed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Tier 4 Summary: ${tier4Passed}/${tier4Results.length} passed.\n`);

  // --------------------------------------------------------------------------
  // MILESTONE M3: Dedicated Verification Suite (14 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [MILESTONE M3] History, Filter & Visual Reports Verification...');
  const m3Results = await runM3VerificationTests(projectRoot);
  let m3Passed = 0;
  m3Results.forEach(r => {
    totalTests++;
    if (r.passed) {
      m3Passed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> M3 Verification Summary: ${m3Passed}/${m3Results.length} passed.\n`);

  // --------------------------------------------------------------------------
  // 3-TIER CATEGORY HIERARCHY: Dedicated Verification Suite (5 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [3-TIER CATEGORY] 3-Tier Category Hierarchy Verification...');
  const cat3tResults = await run3TierCategoryTests(projectRoot);
  let cat3tPassed = 0;
  cat3tResults.forEach(r => {
    totalTests++;
    if (r.passed) {
      cat3tPassed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> 3-Tier Category Summary: ${cat3tPassed}/${cat3tResults.length} passed.\n`);

  // --------------------------------------------------------------------------
  // BIDIRECTIONAL DELETION SYNC: Verification Suite (3 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [DELETION SYNC] Bidirectional Deletion Sync Verification...');
  const delSyncResults = await runDeletionSyncTests(projectRoot);
  let delSyncPassed = 0;
  delSyncResults.forEach(r => {
    totalTests++;
    if (r.passed) {
      delSyncPassed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Deletion Sync Summary: ${delSyncPassed}/${delSyncResults.length} passed.\n`);

  // --------------------------------------------------------------------------
  // SYNC PERFORMANCE & BENCHMARK: Verification Suite (3 Tests)
  // --------------------------------------------------------------------------
  console.log('>>> [SYNC PERFORMANCE] Sync Performance & Benchmark Verification...');
  const syncPerfResults = await runSyncPerformanceTests(projectRoot);
  let syncPerfPassed = 0;
  syncPerfResults.forEach(r => {
    totalTests++;
    if (r.passed) {
      syncPerfPassed++;
      totalPassed++;
      console.log(`  [PASS] ${r.id}: ${r.title} (${r.duration}ms)`);
    } else {
      totalFailed++;
      console.log(`  [FAIL] ${r.id}: ${r.title} (${r.duration}ms)`);
      console.log(`         Error: ${r.error ? r.error.message : 'Unknown error'}`);
    }
  });
  console.log(`-> Sync Performance Summary: ${syncPerfPassed}/${syncPerfResults.length} passed.\n`);

  const durationMs = Date.now() - startTime;
  console.log('================================================================');
  console.log(' FINAL TEST SUITE RESULTS SUMMARY');
  console.log('================================================================');
  console.log(`Tier 1 (Feature Coverage):               ${tier1Passed} / ${tier1Results.length} passed`);
  console.log(`Tier 2 (Boundaries & Edge Cases):        ${tier2Passed} / ${tier2Results.length} passed`);
  console.log(`Tier 3 (Pairwise Interactions):          ${tier3Passed} / ${tier3Results.length} passed`);
  console.log(`Tier 4 (Real-World Scenarios):           ${tier4Passed} / ${tier4Results.length} passed`);
  console.log(`Milestone M3 Verification:               ${m3Passed} / ${m3Results.length} passed`);
  console.log(`3-Tier Category Hierarchy:               ${cat3tPassed} / ${cat3tResults.length} passed`);
  console.log(`Bidirectional Deletion Sync:             ${delSyncPassed} / ${delSyncResults.length} passed`);
  console.log(`Sync Performance & Benchmark:            ${syncPerfPassed} / ${syncPerfResults.length} passed`);
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL TEST CASES:                        ${totalTests}`);
  console.log(`TOTAL PASSED:                            ${totalPassed}`);
  console.log(`TOTAL FAILED:                            ${totalFailed}`);
  console.log(`TOTAL TIME:                              ${(durationMs / 1000).toFixed(2)}s`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    console.error(`❌ TEST SUITE FAILED: ${totalFailed} out of ${totalTests} test cases failed.`);
    process.exit(1);
  } else {
    console.log(`✅ TEST SUITE SUCCESSFUL: All ${totalTests} test cases passed cleanly!`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal execution error in test runner:', err);
  process.exit(1);
});
