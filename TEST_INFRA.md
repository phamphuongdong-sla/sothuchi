# E2E Test Infra: Sổ Thu Chi Cá Nhân

## Test Philosophy
- Requirement-driven, opaque-box testing.
- Verification methodology: Category-Partition + Boundary Value Analysis + Pairwise Interaction + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | Multi-wallet balance accounting & isolation | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Transaction CRUD & local persistence | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Bidirectional D1 SQLite Sync & deletion sync | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | SQL backup export and import integrity | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 5 | Loan, debt and asset lifecycle | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 6 | Vietnamese currency & number-to-words formatting | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Modal interaction, Escape, backdrop click | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Report KPI calculations & 50/30/20 cash flow | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 9 | Offline PWA caching & Service Worker | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 10| Syntax check & deployment configuration | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Node.js test scripts executing with mock DOM/LocalStorage and direct assertions.
- Verification Commands:
  - `node tests/run-all-tests.js`
  - `node tests/m2_verification.test.js`
  - `node tests/m3_verification.test.js`
  - `node tests/deletion_sync.test.js`
  - `node -c app.js sw.js worker.js js/*.js tests/*.js`

## Coverage Thresholds
- Tier 1: >=5 test cases per feature (50+ cases)
- Tier 2: >=5 test cases per feature for boundary/corner conditions (50+ cases)
- Tier 3: Pairwise feature interactions (10+ scenarios)
- Tier 4: Real-world user financial workflows (5+ application scenarios)
- Tier 5: Adversarial edge-case stress tests & Forensic Integrity Audit
