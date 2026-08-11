# Sổ Thu Chi Cá Nhân (PWA)

Ứng dụng web quản lý tài chính cá nhân Progressive Web App (PWA) hỗ trợ chạy offline, giao diện tối ưu cho di động, và tích hợp tự động đồng bộ 2 chiều với Google Sheets thông qua Google Apps Script Web App Endpoint.

---

## 🚀 Hướng Dẫn Tích Hợp Google Sheets (6 Bước)

Để kết nối dữ liệu của ứng dụng với Google Sheets cá nhân, vui lòng thực hiện theo **6 bước hướng dẫn chi tiết** dưới đây:

### Bước 1: Tạo Google Sheet Mới
1. Truy cập [Google Drive](https://drive.google.com) và tạo một Trang tính mới (Google Sheets).
2. Đặt tên cho trang tính, ví dụ: `Sổ Thu Chi 2026`.

### Bước 2: Mở Trình Biên Tập Apps Script
1. Trên thanh menu Google Sheets, chọn **Tiện ích mở rộng** (Extensions) -> **Apps Script**.
2. Xóa toàn bộ nội dung mã mặc định trong file `Mã.gs` (hoặc `Code.gs`).

### Bước 3: Dán Mã Nguồn `Code.gs`
Copy toàn bộ mã nguồn `Code.gs` dưới đây và dán vào trình biên tập Apps Script:

```javascript
/**
 * Code.gs - Google Apps Script Web App Endpoint Backend
 * Column Schema: [ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú, Thời gian tạo, Thời gian cập nhật]
 */

const SHEET_NAME = 'GiaoDich';
const HEADERS = ['ID', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Thời gian tạo', 'Thời gian cập nhật'];

function doGet(e) {
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(5000);
    if (!success) {
      return responseJSON({ status: 'error', message: 'ScriptLock timeout' });
    }

    const params = (e && e.parameter) || {};
    const action = params.action || 'fetchAll';

    if (action === 'ping') {
      return responseJSON({ status: 'ok', version: '1.0' });
    }

    if (action === 'fetchAll') {
      const sheet = getOrCreateSheet();
      const rows = sheet.getDataRange().getValues();
      const transactions = [];

      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0]) continue;
          transactions.push({
            id: String(row[0]),
            date: formatDate(row[1]),
            type: String(row[2]),
            category: String(row[3]),
            amount: Number(row[4]) || 0,
            note: String(row[5] || ''),
            created_at: String(row[6] || ''),
            updated_at: String(row[7] || ''),
            sync_status: 'synced'
          });
        }
      }

      return responseJSON({ status: 'success', transactions: transactions, categories: [] });
    }

    return responseJSON({ status: 'error', message: 'Unknown action parameter' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const success = lock.tryLock(5000);
    if (!success) {
      return responseJSON({ status: 'error', message: 'ScriptLock timeout' });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'Malformed or empty post data' });
    }

    let payload;
    try { payload = JSON.parse(e.postData.contents); } catch (pErr) {
      return responseJSON({ status: 'error', message: 'Malformed JSON payload' });
    }

    if (!payload || !payload.action) {
      return responseJSON({ status: 'error', message: 'Missing payload action' });
    }

    if (payload.action === 'syncBatch') {
      const sheet = getOrCreateSheet();
      const txs = payload.transactions || [];
      const syncedIds = [];

      txs.forEach(function(tx) {
        if (!tx || !tx.id) return;
        const rowIdx = findRowIndexById(sheet, tx.id);
        const nowIso = new Date().toISOString();
        const dateVal = tx.date || nowIso.split('T')[0];
        const createdAt = tx.created_at || tx.createdAt || nowIso;
        const updatedAt = tx.updated_at || tx.updatedAt || nowIso;

        if (tx.sync_status === 'pending_delete') {
          if (rowIdx !== -1) sheet.deleteRow(rowIdx);
          syncedIds.push(tx.id);
        } else if (rowIdx !== -1) {
          sheet.getRange(rowIdx, 1, 1, 8).setValues([[
            tx.id, dateVal, tx.type || 'expense', tx.category || 'Khác',
            Number(tx.amount) || 0, tx.note || '', createdAt, updatedAt
          ]]);
          syncedIds.push(tx.id);
        } else {
          sheet.appendRow([
            tx.id, dateVal, tx.type || 'expense', tx.category || 'Khác',
            Number(tx.amount) || 0, tx.note || '', createdAt, updatedAt
          ]);
          syncedIds.push(tx.id);
        }
      });

      return responseJSON({ status: 'success', synced_ids: syncedIds });
    }

    return responseJSON({ status: 'error', message: 'Unsupported POST action' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getOrCreateSheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function findRowIndexById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function formatDate(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Bước 4: Triển Khai Dưới Dạng Web App
1. Nhấn nút **Triển khai** (Deploy) ở góc trên bên phải -> chọn **Phát hành triển khai mới** (New deployment).
2. Nhấn vào biểu tượng bánh răng ⚙️ bên cạnh "Select type" và chọn **Ứng dụng web** (Web app).

### Bước 5: Cấu Hình Phân Quyền Truy Cập (Permissions Scope Warning)
⚠️ **LƯU Ý PHÂN QUYỀN QUAN TRỌNG**:
- **Mô tả** (Description): `Sổ Thu Chi Backend API`
- **Thực thi dưới danh nghĩa** (Execute as): **Me** (Tôi - địa chỉ email Google của bạn).
- **Ai có quyền truy cập** (Who has access): **Bất kỳ ai** (Anyone).
  *(Phải chọn "Bất kỳ ai" / "Anyone" để ứng dụng web PWA có thể gửi dữ liệu lên Google Sheets mà không bị lỗi xác thực CORS!)*
- Nhấn **Triển khai** (Deploy), sau đó nhấn **Cấp quyền truy cập** (Grant access) và làm theo hướng dẫn cấp phép của Google.

### Bước 6: Dán Endpoint URL vào Ứng Dụng (Copy-Paste Endpoint URL)
1. Sau khi triển khai thành công, Google sẽ cung cấp **URL ứng dụng web** (Web App URL) có dạng:
   `https://script.google.com/macros/s/AKfycbx.../exec`
2. Sao chép (Copy) đường dẫn URL này.
3. Mở ứng dụng **Sổ Thu Chi Cá Nhân**, chuyển sang tab **Cài đặt** (Settings).
4. Dán URL vào ô **Google Apps Script Web App Endpoint URL** và nhấn **Lưu Cài Đặt & Kiểm Tra Kết Nối**.

---

## 🛠️ Xử Lý Sự Cố (Troubleshooting & FAQ)

### 1. Lỗi Kết Nối HTTP 403 / Unauthorized
- **Nguyên nhân**: Chọn sai quyền hạn khi triển khai Web App.
- **Cách khắc phục**: Vào lại Apps Script -> Triển khai -> Quản lý bản triển khai -> Sửa -> Đảm bảo mục "Ai có quyền truy cập" được chọn là **Bất kỳ ai** (Anyone).

### 2. URL Không Hợp Lệ
- **Nguyên nhân**: Đường dẫn thiếu đuôi `/exec` hoặc không dùng giao thức `https://`.
- **Cách khắc phục**: Đường dẫn phải bắt đầu bằng `https://script.google.com/macros/s/` và kết thúc bằng `/exec`.

### 3. Đồng Bộ Khi Offline
- Ứng dụng tự động lưu trữ giao dịch mới vào LocalStorage/IndexedDB khi bạn không có kết nối Internet (`pending_add`). Khi có mạng trở lại, ứng dụng sẽ tự động kích hoạt tiến trình đồng bộ 2 chiều đưa dữ liệu lên Google Sheet.

---

## 📄 Cấu Trúc Dự Án
```json
{
  "project": "Sổ Thu Chi Cá Nhân (PWA)",
  "version": "1.0.0",
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
    "Code.gs",
    "README.md"
  ]
}
```
