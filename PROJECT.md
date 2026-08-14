# Project: Sổ Thu Chi Cá Nhân (PWA + SQLite Cloud D1)

## Architecture
- HTML5, Vanilla CSS3 (CSS Custom Properties for Dark/Light mode), pure JavaScript (ES6+ modular architecture).
- Single Page Application (SPA) with tab-based bottom navigation (Overview/Form, History, Reports/Statistics, Net Worth, Settings).
- Service Worker (`sw.js`) for offline caching of app shell & Chart.js CDN.
- Web App Manifest (`manifest.json`) for Add-to-Home-Screen (A2HS) PWA functionality on iOS/Android.
- Local Storage / IndexedDB + SQLite WASM for offline-first local data storage & SQL dump export.
- Cloudflare Workers + Cloudflare D1 (`worker.js`, `schema.sql`) for 2-way background synchronization with SQLite Cloud Database.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PWA Manifest & App Shell | `manifest.json`, `index.html` mobile-first layout, icons, viewport, dark/light theme engine | M1 | survey |
| 2 | Service Worker & Offline Caching | `sw.js` stale-while-revalidate caching for app shell & CDN assets | M1 | survey |
| 3 | Core Data Model & LocalStorage Manager | Transaction, Category, Asset, Liability & Loan data structures in `js/db.js` | M2 | survey |
| 4 | Quick Transaction Entry Form | Add/Edit transaction form with income/expense toggles, category selector, currency formatting | M2 | survey |
| 5 | Category Customization System | Default categories, add/edit/hide category management modal/view in `js/categories.js` | M2 | survey |
| 6 | Transaction History & Filter/Search | Grouped transaction list by date/month, keyword search, category & date filtering, delete/edit actions in `js/history.js` | M3 | survey |
| 7 | Visual Statistics & Chart.js Reports | Income vs Expense charts, Category breakdown pie/bar charts, net balance summary in `js/charts.js` | M3 | survey |
| 8 | Net Worth & Balance Sheet | Asset & Liability management, Debts & Loans tracker, Audit Logs | M3 | survey |
| 9 | SQLite D1 Backend (`worker.js`) | Production-ready Cloudflare D1 SQLite backend API with `transactions`, `categories`, `assets`, `liabilities`, `loans`, `recurring` | M4 | survey |
| 10 | 2-Way Sync Engine & Offline Queue | Background push/pull sync, Last-Write-Wins (LWW) conflict resolution, sync status indicators in `js/sync.js` | M4 | survey |
| 11 | SQLite SQL Dump Export/Import | Backup database as standard `.sql` script and restore from SQL files in `js/db.js` | M4 | survey |

## Code Layout
- `/index.html`: Main SPA layout, bottom navigation, views, modals, forms.
- `/style.css`: Mobile-first responsive CSS, Dark/Light mode custom properties, smooth transitions, mobile safe areas.
- `/app.js`: Main application entry point, DOM routing, state management, event bindings.
- `/js/db.js`: Local persistence and SQLite export/import engine.
- `/js/categories.js`: Category management logic (default categories, add, edit, soft-hide).
- `/js/history.js`: Transaction history rendering, filtering, search, and grouping logic.
- `/js/charts.js`: Chart.js statistics rendering, balance calculations, income vs expense analysis.
- `/js/sync.js`: Cloudflare D1 & REST API sync engine, URL validation, sync queue, 2-way sync protocol.
- `/manifest.json`: Web App Manifest for PWA.
- `/sw.js`: Service Worker for offline asset caching.
- `/schema.sql`: SQLite Database schema definition.
- `/worker.js`: Cloudflare Worker REST API handler for D1 SQLite.
- `/wrangler.toml`: Cloudflare D1 deployment configuration.
- `/README.md`: User setup and deployment guide.
