# Sổ Thu Chi Cá Nhân (PWA + SQLite Cloud D1)

Ứng dụng web quản lý tài chính cá nhân Progressive Web App (PWA) hỗ trợ chạy offline, giao diện tối ưu cho di động, và tích hợp cơ sở dữ liệu **SQLite Cloud (Cloudflare D1)** hoàn toàn miễn phí.

---

## 🗄️ Hướng Dẫn Tích Hợp SQLite & Cloudflare D1 (Serverless Cloud SQLite)

Ứng dụng kết nối trực tiếp với **Cloudflare D1 (SQLite Serverless)** hoàn toàn miễn phí (5GB storage, 5M read/ngày).

### 1. Khởi tạo Database SQLite D1 trên Cloudflare:
```bash
# 1. Đăng nhập Cloudflare CLI
npx wrangler login

# 2. Tạo database D1 mới
npx wrangler d1 create sothuchi-db

# 3. Khởi tạo bảng dữ liệu từ schema.sql
npx wrangler d1 execute sothuchi-db --remote --file=./schema.sql
```

### 2. Triển khai Worker Backend API:
```bash
# Deploy worker.js lên Cloudflare Workers
npx wrangler deploy
```

### 3. Cấu hình URL Worker trong Ứng Dụng:
Mặc định ứng dụng tự động kết nối với API Backend của bạn. Bạn cũng có thể mở tab **Cài đặt** trên PWA và cập nhật mục **Cấu hình SQLite Database & Cloudflare D1**.

---

## 📥 Phục Hồi & Xuất Backup SQLite Dump (.sql)

Trực tiếp trong giao diện ứng dụng (Tab Cài đặt):
- **Xuất File Backup**: Nhấn **Tải File SQLite Dump (.sql)** để lưu toàn bộ dữ liệu dưới dạng câu lệnh SQL chuẩn (`CREATE TABLE`, `INSERT INTO`).
- **Khôi Phục File SQL**: Nhấn **Chọn File .sql Khôi Phục** để khôi phục toàn bộ giao dịch vào hệ thống.

---

## 📱 Hướng Dẫn Cài Đặt PWA Lên Điện Thoại

### 🍎 Trên iPhone (iOS Safari):
1. Mở ứng dụng bằng trình duyệt **Safari**.
2. Nhấn nút **Chia sẻ (Share)** (hình vuông có mũi tên chỉ lên).
3. Chọn **"Thêm vào MH chính" (Add to Home Screen)**.

### 🤖 Trên Android (Google Chrome):
1. Mở trang web bằng **Chrome**.
2. Nhấn vào dấu **3 chấm (⋮)** ở góc trên cùng bên phải.
3. Chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào màn hình chính"**.

---

## 📄 Cấu Trúc Dự Án
```json
{
  "project": "Sổ Thu Chi Cá Nhân (PWA)",
  "version": "2.0.0",
  "files": [
    "index.html",
    "style.css",
    "app.js",
    "js/db.js",
    "js/categories.js",
    "js/history.js",
    "js/charts.js",
    "js/sync.js",
    "manifest.json",
    "sw.js",
    "schema.sql",
    "worker.js",
    "wrangler.toml",
    "README.md"
  ]
}
```
