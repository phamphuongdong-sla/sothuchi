# Project: Sổ Thu Chi Cá Nhân — Full Codebase Audit & Auto-Fix

## Architecture
- **Client Frontend / PWA**: Single Page Application with offline-first architecture (`index.html`, `style.css`, `app.js`, `sw.js`).
- **Core Modules (`js/`)**:
  - `js/db.js`: DatabaseManager with LocalStorage persistence, normalization, SQL import/export.
  - `js/sync.js`: SyncEngine handling bidirectional sync with Cloudflare D1 SQLite.
  - `js/categories.js`: CategoryManager with 3-tier hierarchy.
  - `js/charts.js`: Financial analytics, KPI summary cards, cash flow, 50/30/20, emergency fund.
  - `js/history.js`: Transaction history filtering, search, pagination, modal triggers.
  - `js/auth.js`: PIN and biometric authentication layer.
- **Backend & Cloud Storage**: Cloudflare Worker (`worker.js`) connected to Cloudflare D1 SQLite (`schema.sql`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1.1 | Multi-wallet in `addTransaction` | Pass `wallet_id` and `wallet_name` to `normalizeTransaction` | M2 | Survey 2 |
| F1.2 | Wallet balance editing | Prevent double-counting by isolating `initial_balance` from `balance` | M2 | Survey 2 |
| F1.3 | SQL Dump Import Alignment | Align `importSql` with 11-column `exportSql` format, restore all tables | M2 | Survey 1 & 2 |
| F1.4 | Remove duplicate `deleteLoan` | Clean up duplicate definition in `DatabaseManager` | M2 | Survey 1 & 2 |
| F1.5 | Dual-casing properties | Support `createdAt`/`created_at` and `updatedAt`/`updated_at` | M2 | Survey 1 & 2 |
| F1.6 | Local GMT+7 Date formatting | Avoid UTC date jump around midnight via `formatLocalYMD` | M2 | Survey 2 |
| F1.7 | Loan editing preservation | Preserve `remaining_amount` and `repayments` on loan edit | M2 | Survey 2 |
| F2.1 | Fix Zombie Resurrection | Delete locally synced transactions when missing from remote in `pullSync` | M1 | Survey 1 & 2 |
| F2.2 | Non-transaction deletions in Worker | Add `DELETE` statement handlers in `worker.js:syncBatch` for all entities | M1 | Survey 1 |
| F2.3 | D1 Batch Statement Chunking | Chunk SQL statements in `worker.js` to max 80 statements per `db.batch()` | M1 | Survey 1 |
| F2.4 | Sync `recurring` & `audit_logs` | Include `recurring` and `audit_logs` in `worker.js:syncBatch` | M1 | Survey 1 |
| F2.5 | Parse loan repayments in sync | Parse `repayments_json` into `repayments` array in `pullSync` | M1 | Survey 1 |
| F2.6 | Service Worker Precache & API Bypass | Precache `./js/*.js` in `sw.js` and bypass Worker `/api/` from cache | M1 | Survey 1 & 3 |
| F3.1 | Internal transfer accounting | Exclude internal transfers from operational income/expense summary | M2 | Survey 2 |
| F3.2 | Emergency Fund calculation | Calculate emergency fund months based on total available liquidity | M2 | Survey 2 |
| F4.1 | Report KPI DOM ID Fix | Support both `total-income` and `report-total-income` in `js/charts.js` | M3 | Survey 2 & 3 |
| F4.2 | Modal Repay Close Button | Map `data-close-modal="repay"` to `modal-repay-loan` in `app.js` | M3 | Survey 3 |
| F4.3 | Global Modal Lifecycle (Escape & Backdrop) | Support Escape key and backdrop clicks to close all 14 modals | M3 | Survey 3 |
| F4.4 | Mobile Virtual Keyboard auto-scroll | Auto-scroll input into view on focus on mobile | M3 | Survey 3 |
| F4.5 | Vietnamese Number-to-Words alias | Expose `window.docSoThanhChu` alias for `numberToVietnameseWords` | M3 | Survey 3 |
| F5.1 | Comprehensive E2E Testing Suite | Tier 1 (Feature), Tier 2 (Boundary), Tier 3 (Cross-feature), Tier 4 (Workload) | M4 | Original Request |
| F5.2 | Adversarial Hardening & Forensic Audit | Deep stress testing and integrity verification | M4 | Project Policy |
| F5.3 | Syntax & Deploy Validation | `node -c`, Cloudflare D1/Worker, Cloudflare Pages, Git repo | M4 | Original Request |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend, Cloudflare D1 & Sync Engine | `worker.js`, `js/sync.js`, `schema.sql`, `sw.js` (F2.1–F2.6) | none | DONE |
| M2 | Storage Integrity & Accounting Logic | `js/db.js`, `js/charts.js`, `js/history.js` (F1.1–F1.7, F3.1–F3.2) | none | DONE |
| M3 | UI/UX, Mobile Experience & Modals | `index.html`, `app.js`, `style.css` (F4.1–F4.5) | none | DONE |
| M4 | E2E Testing Suite, Audit & Deploy | Test suites (Tiers 1-5), Cloudflare & Git deploy (F5.1–F5.3) | M1, M2, M3 | DONE |

## Interface Contracts
### `worker.js` ↔ `js/sync.js`
- `/api/syncBatch` accepts `{ transactions, wallets, categories, assets, liabilities, loans, recurring, audit_logs }`.
- Entities with `sync_status === 'pending_delete'` or `is_deleted === 1` are deleted from D1.
- `executeBatchSafe` chunks D1 queries to <=80 statements per batch.
- Response returns `{ success: true, synced_count: N, remote_updates: [...] }`.

### `js/db.js` ↔ `app.js` / `js/charts.js`
- `addTransaction` accepts `{ wallet_id, wallet_name, ... }`.
- `normalizeTransaction` outputs `{ id, date, type, category, amount, note, wallet_id, wallet_name, created_at, createdAt, updated_at, updatedAt, sync_status }`.
- `saveWallet` accepts updated wallet metadata without overwriting `initial_balance` unless explicitly modified.
- `calculateSummary` excludes transfer transactions from total operational income/expense.

## Code Layout
- `worker.js`: Cloudflare Worker entry point.
- `schema.sql`: Cloudflare D1 SQLite DDL schema.
- `sw.js`: Service Worker offline caching.
- `index.html`: Web UI markup and modal definitions.
- `style.css`: Responsive design & CSS custom properties.
- `app.js`: Main UI controllers, modal handlers, number formatting.
- `js/`: Modular services (`db.js`, `sync.js`, `categories.js`, `charts.js`, `history.js`, `auth.js`).
- `tests/`: Automated test suites.
