# E2E Test Infra: Sổ Thu Chi Cá Nhân

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | PWA Manifest & App Shell | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 2 | Service Worker & Offline Caching | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 3 | Core Data Model & LocalStorage Manager | ORIGINAL_REQUEST § R1, R2 | 5 | 5 | ✓ |
| 4 | Quick Transaction Entry Form | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 5 | Category Customization System | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 6 | Transaction History & Filter/Search | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 7 | Visual Statistics & Chart.js Reports | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 8 | Settings View & GAS Endpoint Config | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 9 | Google Apps Script Backend (`Code.gs`) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 10 | 2-Way Sync Engine & Offline Queue | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 11 | User Integration & Setup Guide | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Node.js E2E Test Suite Runner (`tests/run-all-tests.js`)
- Test case format: Standardized JavaScript test modules exporting async test runners with detailed assertion logs.
- Directory layout:
  - `/tests/run-all-tests.js`: Main test suite runner
  - `/tests/tier1_features.test.js`: Tier 1 Feature Coverage tests (55 test cases, 5 per feature)
  - `/tests/tier2_boundaries.test.js`: Tier 2 Boundary & Corner Case tests (55 test cases, 5 per feature)
  - `/tests/tier3_pairwise.test.js`: Tier 3 Cross-Feature Pairwise Interaction tests (11 test cases)
  - `/tests/tier4_scenarios.test.js`: Tier 4 Real-World Application Scenarios (5 test cases)
  - `/tests/test-utils.js`: Shared test harness utilities (mock DOM/browser environment, assertion helpers, GAS mock server, offline storage emulator)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Daily Expense Recording & Offline Sync | F3, F4, F6, F7, F10 | Medium |
| 2 | Custom Category Setup & Transaction Categorization | F3, F4, F5, F6, F7 | Medium |
| 3 | Apps Script Endpoint Setup & 2-Way Sync Protocol | F8, F9, F10, F11 | High |
| 4 | PWA Installation, Offline Mode & Service Worker Cache | F1, F2, F3, F4, F10 | High |
| 5 | Monthly Financial Review & Filtering Report Generation | F3, F6, F7, F8 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (55 total across 11 features)
- Tier 2: ≥5 per feature (55 total across 11 features)
- Tier 3: pairwise coverage of major feature interactions (11 total)
- Tier 4: ≥5 realistic application scenarios (5 total)
- Total Test Cases: 126 test cases
