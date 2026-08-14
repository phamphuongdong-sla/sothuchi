-- ============================================================================
-- SỔ THU CHI CÁ NHÂN - SQLITE DATABASE SCHEMA (schema.sql)
-- Chuẩn hóa cho Cloudflare D1 / SQLite WASM / PocketBase / Turso
-- ============================================================================

-- 1. Bảng Giao Dịch (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                  -- Định dạng YYYY-MM-DD
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'synced'
);

-- Chỉ mục tối ưu tốc độ lọc theo Ngày & Hạng Mục
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 2. Bảng Hạng Mục Thu Chi (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#4f46e5',
  is_hidden INTEGER DEFAULT 0,         -- 0: Hiện, 1: Ẩn
  sort_order INTEGER DEFAULT 0
);

-- 3. Bảng Tài Sản (Assets) - Net Worth
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Tài khoản ngân hàng',
  value REAL DEFAULT 0 CHECK(value >= 0),
  note TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

-- 4. Bảng Khoản Nợ (Liabilities) - Net Worth
CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Thẻ tín dụng',
  total_debt REAL DEFAULT 0 CHECK(total_debt >= 0),
  remaining_debt REAL DEFAULT 0 CHECK(remaining_debt >= 0),
  note TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

-- 5. Bảng Vay & Cho Vay (Loans)
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('loan', 'debt')), -- 'loan': Cho vay, 'debt': Vay nợ
  person_name TEXT NOT NULL,
  original_amount REAL DEFAULT 0 CHECK(original_amount >= 0),
  remaining_amount REAL DEFAULT 0 CHECK(remaining_amount >= 0),
  due_date TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paid')),
  repayments_json TEXT DEFAULT '[]',   -- Chuỗi JSON danh sách các đợt trả
  updated_at TEXT NOT NULL
);

-- 6. Bảng Chi Tiêu Định Kỳ (Recurring Ledger)
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount REAL DEFAULT 0 CHECK(amount >= 0),
  category TEXT NOT NULL,
  note TEXT DEFAULT '',
  frequency TEXT DEFAULT 'monthly',
  day_of_month INTEGER DEFAULT 1 CHECK(day_of_month BETWEEN 1 AND 31),
  last_run_date TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1          -- 1: Bật, 0: Tắt
);

-- 7. Bảng Lịch Sử Sửa Đổi (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,                -- 'add', 'update', 'delete', 'revert'
  entity_type TEXT NOT NULL,           -- 'transaction', 'category', 'asset', ...
  entity_id TEXT NOT NULL,
  old_data_json TEXT,                  -- Chuỗi JSON dữ liệu cũ
  new_data_json TEXT                   -- Chuỗi JSON dữ liệu mới
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- ============================================================================
-- DỮ LIỆU MẶC ĐỊNH CHO HẠNG MỤC (DEFAULT CATEGORIES)
-- ============================================================================
INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_hidden, sort_order) VALUES
  ('cat_inc_1', 'Lương', 'income', '💵', '#10b981', 0, 1),
  ('cat_inc_2', 'Thưởng', 'income', '🎁', '#059669', 0, 2),
  ('cat_inc_3', 'Đầu tư', 'income', '📈', '#047857', 0, 3),
  ('cat_inc_4', 'Thu hồi nợ', 'income', '🔄', '#0d9488', 0, 4),
  ('cat_inc_5', 'Thu nhập khác', 'income', '💰', '#14b8a6', 0, 5),
  ('cat_exp_1', 'Ăn uống', 'expense', '🍲', '#ef4444', 0, 6),
  ('cat_exp_2', 'Mua sắm', 'expense', '🛍️', '#f97316', 0, 7),
  ('cat_exp_3', 'Di chuyển', 'expense', '🚗', '#f59e0b', 0, 8),
  ('cat_exp_4', 'Hóa đơn & Tiện ích', 'expense', '🏠', '#8b5cf6', 0, 9),
  ('cat_exp_5', 'Giải trí', 'expense', '🎬', '#ec4899', 0, 10),
  ('cat_exp_6', 'Y tế & Sức khỏe', 'expense', '🏥', '#06b6d4', 0, 11),
  ('cat_exp_7', 'Giáo dục', 'expense', '📚', '#3b82f6', 0, 12),
  ('cat_exp_8', 'Trả nợ vay', 'expense', '💸', '#64748b', 0, 13),
  ('cat_exp_9', 'Chi khác', 'expense', '📦', '#6b7280', 0, 14);
