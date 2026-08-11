# Project: Sổ Thu Chi Cá Nhân (PWA)

## Architecture
- HTML5, Vanilla CSS3 (CSS Custom Properties for Dark/Light mode), pure JavaScript (ES6+ modular architecture).
- Single Page Application (SPA) with tab-based bottom navigation (Overview/Form, History, Reports/Statistics, Settings).
- Service Worker (`sw.js`) for offline caching of app shell & Chart.js CDN.
- Web App Manifest (`manifest.json`) for Add-to-Home-Screen (A2HS) PWA functionality on iOS/Android.
- Local Storage / IndexedDB for offline-first local data storage.
- Google Apps Script Web App Endpoint (`Code.gs`) for 2-way background synchronization with Google Sheets.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PWA Manifest & App Shell | `manifest.json`, `index.html` mobile-first layout, icons, viewport, dark/light theme engine | M1 | survey |
| 2 | Service Worker & Offline Caching | `sw.js` stale-while-revalidate caching for app shell & CDN assets | M1 | survey |
| 3 | Core Data Model & LocalStorage Manager | Transaction & Category data structures, local persistence layer in `js/db.js` | M2 | survey |
| 4 | Quick Transaction Entry Form | Add/Edit transaction form with income/expense toggles, category selector, currency formatting | M2 | survey |
| 5 | Category Customization System | Default categories, add/edit/hide category management modal/view in `js/categories.js` | M2 | survey |
| 6 | Transaction History & Filter/Search | Grouped transaction list by date/month, keyword search, category & date filtering, delete/edit actions in `js/history.js` | M3 | survey |
| 7 | Visual Statistics & Chart.js Reports | Income vs Expense charts, Category breakdown pie/bar charts, net balance summary in `js/charts.js` | M3 | survey |
| 8 | Settings View & GAS Endpoint Config | Settings page UI, URL validation, connection test (`?action=ping`), auto-sync settings | M4 | survey |
| 9 | Google Apps Script Backend (`Code.gs`) | Production-ready `Code.gs` script with columns `[ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú, Thời gian tạo, Thời gian cập nhật]`, LockService, CORS-safe JSON | M4 | survey |
| 10 | 2-Way Sync Engine & Offline Queue | Background push/pull sync, Last-Write-Wins (LWW) conflict resolution, sync status indicators (`Offline`, `Syncing`, `Success`, `Error`) in `js/sync.js` | M4 | survey |
| 11 | User Integration & Setup Guide | Step-by-step 6-step walkthrough for GAS deployment and permissions setup in `README.md` | M4 | survey |

## Code Layout
- `/index.html`: Main SPA layout, bottom navigation, views, modals, forms.
- `/style.css`: Mobile-first responsive CSS, Dark/Light mode custom properties, smooth transitions, mobile safe areas.
- `/app.js`: Main application entry point, DOM routing, state management, event bindings.
- `/js/db.js`: Local persistence (LocalStorage / IndexedDB manager) and data models.
- `/js/categories.js`: Category management logic (default categories, add, edit, soft-hide).
- `/js/history.js`: Transaction history rendering, filtering, search, and grouping logic.
- `/js/charts.js`: Chart.js statistics rendering, balance calculations, income vs expense analysis.
- `/js/sync.js`: Google Sheets API sync engine, URL validation, sync queue, 2-way sync protocol.
- `/manifest.json`: Web App Manifest for PWA.
- `/sw.js`: Service Worker for offline asset caching.
- `/Code.gs`: Template Google Apps Script backend script.
- `/README.md`: User setup guide for Google Sheets & Apps Script deployment.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | PWA Shell & Theme Infrastructure | `index.html`, `style.css`, `manifest.json`, `sw.js`, icons, Dark/Light theme toggle | none | DONE |
| M2 | Finance Core & Category Management | `js/db.js`, `js/categories.js`, quick entry form UI & logic in `app.js` | M1 | DONE |
| M3 | History, Filter & Visual Reports | `js/history.js`, `js/charts.js`, Chart.js CDN integration, search/filter | M2 | DONE |
| M4 | Google Sheets Sync & GAS Endpoint | `js/sync.js`, `Code.gs`, Settings View, 2-way sync engine, `README.md` guide | M2 | DONE |

## Interface Contracts
### `db.js` ↔ `app.js` / `history.js` / `charts.js`
- `DB.getTransactions()`: Returns array of transaction objects.
- `DB.addTransaction(data)`: Saves new transaction, marks `sync_status = 'pending_add'`.
- `DB.updateTransaction(id, data)`: Updates transaction, marks `sync_status = 'pending_update'`.
- `DB.deleteTransaction(id)`: Soft/hard deletes transaction, marks `sync_status = 'pending_delete'`.
- `DB.getCategories()`: Returns list of categories (active + hidden).

### `sync.js` ↔ `Code.gs`
- `GET ?action=ping`: Returns `{ status: "ok", version: "1.0" }`.
- `GET ?action=fetchAll`: Returns `{ status: "success", transactions: [...], categories: [...] }`.
- `POST`: Content-Type `text/plain;charset=utf-8` payload `{ action: "syncBatch", transactions: [...] }`.
- Response: `{ status: "success", synced_ids: [...], remote_updates: [...] }`.
