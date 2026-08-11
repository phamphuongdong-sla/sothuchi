/**
 * Code.gs - Google Apps Script Multi-Sheet Endpoint Backend
 * 
 * Multi-Sheet Database Architecture:
 * 1. Sheet "GiaoDich" : [ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú, Thời gian tạo, Thời gian cập nhật]
 * 2. Sheet "DanhMuc"  : [ID, Tên Hạng Mục, Nhóm Chính, Loại, Icon, Màu Sắc, Trạng Thái]
 * 3. Sheet "CauHinh"  : [Tên Cấu Hình, Giá Trị, Ghi Chú]
 */

const SHEET_TX = 'GiaoDich';
const HEADERS_TX = ['ID', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Thời gian tạo', 'Thời gian cập nhật'];

const SHEET_CAT = 'DanhMuc';
const HEADERS_CAT = ['ID', 'Tên Hạng Mục', 'Nhóm Chính', 'Loại', 'Icon', 'Màu Sắc', 'Trạng Thái'];

const SHEET_CFG = 'CauHinh';
const HEADERS_CFG = ['Tên Cấu Hình', 'Giá Trị', 'Ghi Chú'];

/**
 * Handle HTTP GET Requests
 */
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
      return responseJSON({ status: 'ok', version: '2.1', architecture: 'Multi-Sheet + OTP Mail' });
    }

    if (action === 'sendOtp') {
      return handleSendOtp({ email: params.email });
    }

    if (action === 'verifyOtp') {
      return handleVerifyOtp({ email: params.email, otp: params.otp });
    }

    if (action === 'syncBatch') {
      let txs = [];
      if (params.payload) {
        try {
          const parsed = JSON.parse(decodeURIComponent(params.payload));
          txs = parsed.transactions || [];
        } catch (pe) {
          try {
            const parsed = JSON.parse(params.payload);
            txs = parsed.transactions || [];
          } catch (pe2) {}
        }
      }
      return processSyncBatch(txs);
    }

    if (action === 'fetchAll') {
      const sheetTx = getOrCreateNamedSheet(SHEET_TX, HEADERS_TX);
      const rowsTx = sheetTx.getDataRange().getValues();
      const transactions = [];

      if (rowsTx.length > 1) {
        for (let i = 1; i < rowsTx.length; i++) {
          const row = rowsTx[i];
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

      // Fetch Categories from Sheet "DanhMuc"
      const sheetCat = getOrCreateNamedSheet(SHEET_CAT, HEADERS_CAT);
      const rowsCat = sheetCat.getDataRange().getValues();
      const categories = [];

      if (rowsCat.length > 1) {
        for (let i = 1; i < rowsCat.length; i++) {
          const row = rowsCat[i];
          if (!row[0]) continue;
          categories.push({
            id: String(row[0]),
            name: String(row[1]),
            group: String(row[2] || ''),
            type: String(row[3] || 'expense'),
            icon: String(row[4] || '📁'),
            color: String(row[5] || '#ef4444'),
            is_hidden: String(row[6]) === 'Ẩn'
          });
        }
      }

      // Fetch Config from Sheet "CauHinh"
      const sheetCfg = getOrCreateNamedSheet(SHEET_CFG, HEADERS_CFG);
      const rowsCfg = sheetCfg.getDataRange().getValues();
      const config = {};

      if (rowsCfg.length > 1) {
        for (let i = 1; i < rowsCfg.length; i++) {
          const row = rowsCfg[i];
          if (row[0]) config[String(row[0])] = String(row[1] || '');
        }
      }

      return responseJSON({
        status: 'success',
        transactions: transactions,
        categories: categories,
        config: config
      });
    }

    return responseJSON({ status: 'error', message: 'Unknown action parameter' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Handle HTTP POST Requests
 */
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
    try { payload = JSON.parse(e.postData.contents); } catch (parseErr) {
      return responseJSON({ status: 'error', message: 'Malformed JSON payload' });
    }

    if (!payload || !payload.action) {
      return responseJSON({ status: 'error', message: 'Missing payload action' });
    }

    if (payload.action === 'sendOtp') {
      return handleSendOtp(payload);
    }

    if (payload.action === 'verifyOtp') {
      return handleVerifyOtp(payload);
    }

    if (payload.action === 'syncBatch') {
      return processSyncBatch(payload.transactions || []);
    }

    if (payload.action === 'saveCategories') {
      const sheetCat = getOrCreateNamedSheet(SHEET_CAT, HEADERS_CAT);
      sheetCat.clearContents();
      sheetCat.appendRow(HEADERS_CAT);

      (payload.categories || []).forEach(c => {
        sheetCat.appendRow([
          c.id || '', c.name || '', c.group || '', c.type || 'expense',
          c.icon || '📁', c.color || '#ef4444', c.is_hidden ? 'Ẩn' : 'Hiển thị'
        ]);
      });
      return responseJSON({ status: 'success', count: (payload.categories || []).length });
    }

    if (payload.action === 'saveConfig') {
      const sheetCfg = getOrCreateNamedSheet(SHEET_CFG, HEADERS_CFG);
      sheetCfg.clearContents();
      sheetCfg.appendRow(HEADERS_CFG);

      const cfgObj = payload.config || {};
      Object.keys(cfgObj).forEach(k => {
        sheetCfg.appendRow([k, String(cfgObj[k] || ''), 'Config item']);
      });
      return responseJSON({ status: 'success' });
    }

    return responseJSON({ status: 'error', message: 'Unsupported POST action: ' + payload.action });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Handle sending OTP Email via MailApp
 */
function handleSendOtp(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return responseJSON({ status: 'error', message: 'Email nhận OTP không hợp lệ' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes

  // Save to CauHinh sheet
  const sheetCfg = getOrCreateNamedSheet(SHEET_CFG, HEADERS_CFG);
  const cfgData = sheetCfg.getDataRange().getValues();
  const key = 'OTP_' + email;
  const val = otp + '|' + expiresAt;

  let foundRow = -1;
  for (let i = 1; i < cfgData.length; i++) {
    if (String(cfgData[i][0]) === key) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheetCfg.getRange(foundRow, 2).setValue(val);
  } else {
    sheetCfg.appendRow([key, val, 'OTP đổi mật khẩu']);
  }

  // Send Email via MailApp
  try {
    const subject = '🔐 Mã OTP đổi mật khẩu Sổ Thu Chi';
    const body = 'Mã OTP của bạn là: ' + otp + '. Mã này có hiệu lực trong 3 phút. Vui lòng không chia sẻ cho người khác.';
    const htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">' +
      '<div style="text-align: center; margin-bottom: 20px;">' +
      '<h2 style="color: #4f46e5; margin: 0;">🔐 Sổ Thu Chi Cá Nhân</h2>' +
      '<p style="color: #64748b; font-size: 14px; margin-top: 5px;">Mã xác thực đổi mật khẩu tài khoản</p>' +
      '</div>' +
      '<p style="color: #334155;">Chào bạn,</p>' +
      '<p style="color: #334155;">Bạn vừa yêu cầu mã OTP để đổi mật khẩu cho tài khoản: <strong>' + email + '</strong></p>' +
      '<div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #eef2ff; border: 1px dashed #6366f1; padding: 16px; text-align: center; border-radius: 10px; margin: 20px 0;">' + otp + '</div>' +
      '<p style="color: #ef4444; font-size: 13px; text-align: center; margin-bottom: 20px;">⚠️ Mã này có hiệu lực trong <strong>3 phút</strong>. Không chia sẻ mã này cho bất kỳ ai!</p>' +
      '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">' +
      '<p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Đây là email tự động từ hệ thống Sổ Thu Chi Cá Nhân. Vui lòng không phản hồi email này.</p>' +
      '</div>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody
    });

    return responseJSON({ status: 'success', message: 'Mã OTP đã được gửi đến email ' + email });
  } catch (mailErr) {
    return responseJSON({ status: 'error', message: 'Lỗi gửi email OTP: ' + mailErr.toString() });
  }
}

/**
 * Handle verifying OTP
 */
function handleVerifyOtp(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const inputOtp = String(payload.otp || '').trim();

  if (!email || !inputOtp) {
    return responseJSON({ status: 'error', message: 'Vui lòng cung cấp email và mã OTP' });
  }

  const sheetCfg = getOrCreateNamedSheet(SHEET_CFG, HEADERS_CFG);
  const cfgData = sheetCfg.getDataRange().getValues();
  const key = 'OTP_' + email;

  let storedVal = '';
  let foundRow = -1;
  for (let i = 1; i < cfgData.length; i++) {
    if (String(cfgData[i][0]) === key) {
      storedVal = String(cfgData[i][1] || '');
      foundRow = i + 1;
      break;
    }
  }

  if (!storedVal) {
    return responseJSON({ status: 'error', message: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng nhấn gửi lại mã!' });
  }

  const parts = storedVal.split('|');
  const savedOtp = parts[0];
  const expiresAt = Number(parts[1] || 0);

  if (Date.now() > expiresAt) {
    if (foundRow > 0) sheetCfg.deleteRow(foundRow);
    return responseJSON({ status: 'error', message: 'Mã OTP đã hết hạn (quá 3 phút). Vui lòng yêu cầu mã mới!' });
  }

  if (savedOtp !== inputOtp) {
    return responseJSON({ status: 'error', message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại!' });
  }

  // Delete OTP after successful validation
  if (foundRow > 0) sheetCfg.deleteRow(foundRow);

  return responseJSON({ status: 'success', message: 'Xác thực OTP thành công!' });
}

/**
 * Shared syncBatch processor used for Sheet "GiaoDich"
 */
function processSyncBatch(txs) {
  const sheet = getOrCreateNamedSheet(SHEET_TX, HEADERS_TX);
  const syncedIds = [];
  if (!txs || !Array.isArray(txs) || txs.length === 0) {
    return responseJSON({ status: 'success', synced_ids: [] });
  }

  const dataRange = sheet.getDataRange ? sheet.getDataRange() : null;
  const rows = dataRange && typeof dataRange.getValues === 'function' ? dataRange.getValues() : [];

  const headerRow = (rows && rows.length > 0 && rows[0].length >= 8) ? rows[0] : HEADERS_TX;
  const existingRowsMap = new Map();
  if (rows && rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0]) {
        existingRowsMap.set(String(rows[i][0]), rows[i]);
      }
    }
  }

  const nowIso = new Date().toISOString();

  txs.forEach(function(tx) {
    if (!tx || !tx.id) return;
    const txId = String(tx.id);
    syncedIds.push(tx.id);

    if (tx.sync_status === 'pending_delete') {
      existingRowsMap.delete(txId);
    } else {
      const dateVal = tx.date || nowIso.split('T')[0];
      const createdAt = tx.created_at || tx.createdAt || nowIso;
      const updatedAt = tx.updated_at || tx.updatedAt || nowIso;
      const rowVal = [
        tx.id, dateVal, tx.type || 'expense', tx.category || 'Khác',
        Number(tx.amount) || 0, tx.note || '', createdAt, updatedAt
      ];
      existingRowsMap.set(txId, rowVal);
    }
  });

  const workingRows = [headerRow];
  existingRowsMap.forEach(function(rowVal) {
    workingRows.push(rowVal);
  });

  if (typeof sheet.clearContents === 'function') {
    sheet.clearContents();
  }
  if (typeof sheet.getRange === 'function' && workingRows.length > 0) {
    sheet.getRange(1, 1, workingRows.length, 8).setValues(workingRows);
  }

  return responseJSON({
    status: 'success',
    synced_ids: syncedIds
  });
}

function getOrCreateNamedSheet(name, headers) {
  let ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) return new MockSheet();

  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function formatDate(val) {
  if (!val) {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  if (val instanceof Date) {
    var year = val.getFullYear();
    var month = String(val.getMonth() + 1).padStart(2, '0');
    var day = String(val.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  var str = String(val).trim();
  if (str.indexOf('T') !== -1) {
    str = str.split('T')[0];
  }
  return str;
}

function responseJSON(obj) {
  if (typeof ContentService !== 'undefined' && ContentService.createTextOutput) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return obj;
}

function MockSheet() {
  this.getValues = () => [];
  this.getDataRange = () => ({ getValues: () => [] });
  this.appendRow = () => {};
  this.deleteRow = () => {};
  this.clearContents = () => {};
  this.getLastRow = () => 0;
  this.getRange = () => ({ setValues: () => {} });
}
