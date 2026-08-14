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

const SHEET_ASSET = 'TaiSan';
const HEADERS_ASSET = ['ID', 'Tên Tài Sản', 'Phân Loại', 'Giá Trị', 'Ghi Chú', 'Cập Nhật'];

const SHEET_LIAB = 'KhoanNo';
const HEADERS_LIAB = ['ID', 'Tên Khoản Nợ', 'Phân Loại', 'Tổng Nợ', 'Dư Nợ Còn Lại', 'Ghi Chú', 'Cập Nhật'];

const SHEET_LOAN = 'SoVay';
const HEADERS_LOAN = ['ID', 'Loại', 'Tên Đối Tác', 'Số Tiền Ban Đầu', 'Số Tiền Còn Lại', 'Hạn Trả', 'Trạng Thái', 'Ghi Chú', 'Cập Nhật'];

const SHEET_AUDIT = 'NhatKyAudit';
const HEADERS_AUDIT = ['ID', 'Hành Động', 'Đối Tượng', 'Đối Tượng ID', 'Thời Gian', 'Chi Tiết Cũ', 'Chi Tiết Mới'];

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
      let payloadObj = {};
      if (params.payload) {
        try {
          payloadObj = JSON.parse(decodeURIComponent(params.payload));
        } catch (pe) {
          try {
            payloadObj = JSON.parse(params.payload);
          } catch (pe2) {}
        }
      }
      return processSyncBatch(payloadObj);
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

      // Fetch Assets from Sheet "TaiSan"
      const sheetAsset = getOrCreateNamedSheet(SHEET_ASSET, HEADERS_ASSET);
      const rowsAsset = sheetAsset.getDataRange().getValues();
      const assets = [];
      if (rowsAsset.length > 1) {
        for (let i = 1; i < rowsAsset.length; i++) {
          const r = rowsAsset[i];
          if (r[0]) assets.push({ id: String(r[0]), name: String(r[1]), category: String(r[2]), value: Number(r[3]) || 0, note: String(r[4] || ''), updated_at: String(r[5] || '') });
        }
      }

      // Fetch Liabilities from Sheet "KhoanNo"
      const sheetLiab = getOrCreateNamedSheet(SHEET_LIAB, HEADERS_LIAB);
      const rowsLiab = sheetLiab.getDataRange().getValues();
      const liabilities = [];
      if (rowsLiab.length > 1) {
        for (let i = 1; i < rowsLiab.length; i++) {
          const r = rowsLiab[i];
          if (r[0]) liabilities.push({ id: String(r[0]), name: String(r[1]), category: String(r[2]), total_debt: Number(r[3]) || 0, remaining_debt: Number(r[4]) || 0, note: String(r[5] || ''), updated_at: String(r[6] || '') });
        }
      }

      // Fetch Loans from Sheet "SoVay"
      const sheetLoan = getOrCreateNamedSheet(SHEET_LOAN, HEADERS_LOAN);
      const rowsLoan = sheetLoan.getDataRange().getValues();
      const loans = [];
      if (rowsLoan.length > 1) {
        for (let i = 1; i < rowsLoan.length; i++) {
          const r = rowsLoan[i];
          if (r[0]) loans.push({ id: String(r[0]), type: String(r[1]), person_name: String(r[2]), original_amount: Number(r[3]) || 0, remaining_amount: Number(r[4]) || 0, due_date: String(r[5] || ''), status: String(r[6] || 'active'), note: String(r[7] || ''), updated_at: String(r[8] || '') });
        }
      }

      return responseJSON({
        status: 'success',
        transactions: transactions,
        categories: categories,
        config: config,
        assets: assets,
        liabilities: liabilities,
        loans: loans
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

    if (payload.action === 'saveAssets') {
      const sheetAsset = getOrCreateNamedSheet(SHEET_ASSET, HEADERS_ASSET);
      sheetAsset.clearContents();
      sheetAsset.appendRow(HEADERS_ASSET);
      (payload.assets || []).forEach(a => {
        sheetAsset.appendRow([a.id || '', a.name || '', a.category || '', Number(a.value) || 0, a.note || '', a.updated_at || '']);
      });
      return responseJSON({ status: 'success', count: (payload.assets || []).length });
    }

    if (payload.action === 'saveLiabilities') {
      const sheetLiab = getOrCreateNamedSheet(SHEET_LIAB, HEADERS_LIAB);
      sheetLiab.clearContents();
      sheetLiab.appendRow(HEADERS_LIAB);
      (payload.liabilities || []).forEach(l => {
        sheetLiab.appendRow([l.id || '', l.name || '', l.category || '', Number(l.total_debt) || 0, Number(l.remaining_debt) || 0, l.note || '', l.updated_at || '']);
      });
      return responseJSON({ status: 'success', count: (payload.liabilities || []).length });
    }

    if (payload.action === 'saveLoans') {
      const sheetLoan = getOrCreateNamedSheet(SHEET_LOAN, HEADERS_LOAN);
      sheetLoan.clearContents();
      sheetLoan.appendRow(HEADERS_LOAN);
      (payload.loans || []).forEach(l => {
        sheetLoan.appendRow([l.id || '', l.type || 'loan', l.person_name || '', Number(l.original_amount) || 0, Number(l.remaining_amount) || 0, l.due_date || '', l.status || 'active', l.note || '', l.updated_at || '']);
      });
      return responseJSON({ status: 'success', count: (payload.loans || []).length });
    }

    if (payload.action === 'saveAuditLogs') {
      const sheetAudit = getOrCreateNamedSheet(SHEET_AUDIT, HEADERS_AUDIT);
      sheetAudit.clearContents();
      sheetAudit.appendRow(HEADERS_AUDIT);
      (payload.auditLogs || []).forEach(l => {
        sheetAudit.appendRow([l.id || '', l.action || '', l.entity_type || '', l.entity_id || '', l.timestamp || '', JSON.stringify(l.old_data || ''), JSON.stringify(l.new_data || '')]);
      });
      return responseJSON({ status: 'success', count: (payload.auditLogs || []).length });
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
 * Shared syncBatch processor used for all Sheets (GiaoDich, TaiSan, KhoanNo, SoVay, NhatKyAudit)
 */
function processSyncBatch(payload) {
  let txs = [];
  let assets = null;
  let liabilities = null;
  let loans = null;
  let auditLogs = null;

  if (Array.isArray(payload)) {
    txs = payload;
  } else if (payload && typeof payload === 'object') {
    txs = payload.transactions || [];
    assets = payload.assets || null;
    liabilities = payload.liabilities || null;
    loans = payload.loans || null;
    auditLogs = payload.auditLogs || null;
  }

  // 1. Process Transactions (Sheet "GiaoDich")
  const sheetTx = getOrCreateNamedSheet(SHEET_TX, HEADERS_TX);
  const syncedIds = [];

  if (txs && Array.isArray(txs) && txs.length > 0) {
    const dataRange = sheetTx.getDataRange ? sheetTx.getDataRange() : null;
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

    if (typeof sheetTx.clearContents === 'function') sheetTx.clearContents();
    if (typeof sheetTx.getRange === 'function' && workingRows.length > 0) {
      sheetTx.getRange(1, 1, workingRows.length, 8).setValues(workingRows);
    }
  }

  // 2. Process Assets (Sheet "TaiSan")
  if (Array.isArray(assets)) {
    const sheetAsset = getOrCreateNamedSheet(SHEET_ASSET, HEADERS_ASSET);
    sheetAsset.clearContents();
    sheetAsset.appendRow(HEADERS_ASSET);
    assets.forEach(a => {
      sheetAsset.appendRow([a.id || '', a.name || '', a.category || '', Number(a.value) || 0, a.note || '', a.updated_at || '']);
    });
  }

  // 3. Process Liabilities (Sheet "KhoanNo")
  if (Array.isArray(liabilities)) {
    const sheetLiab = getOrCreateNamedSheet(SHEET_LIAB, HEADERS_LIAB);
    sheetLiab.clearContents();
    sheetLiab.appendRow(HEADERS_LIAB);
    liabilities.forEach(l => {
      sheetLiab.appendRow([l.id || '', l.name || '', l.category || '', Number(l.total_debt) || 0, Number(l.remaining_debt) || 0, l.note || '', l.updated_at || '']);
    });
  }

  // 4. Process Loans (Sheet "SoVay")
  if (Array.isArray(loans)) {
    const sheetLoan = getOrCreateNamedSheet(SHEET_LOAN, HEADERS_LOAN);
    sheetLoan.clearContents();
    sheetLoan.appendRow(HEADERS_LOAN);
    loans.forEach(l => {
      sheetLoan.appendRow([l.id || '', l.type || 'loan', l.person_name || '', Number(l.original_amount) || 0, Number(l.remaining_amount) || 0, l.due_date || '', l.status || 'active', l.note || '', l.updated_at || '']);
    });
  }

  // 5. Process Audit Logs (Sheet "NhatKyAudit")
  if (Array.isArray(auditLogs)) {
    const sheetAudit = getOrCreateNamedSheet(SHEET_AUDIT, HEADERS_AUDIT);
    sheetAudit.clearContents();
    sheetAudit.appendRow(HEADERS_AUDIT);
    auditLogs.forEach(l => {
      sheetAudit.appendRow([l.id || '', l.action || '', l.entity_type || '', l.entity_id || '', l.timestamp || '', JSON.stringify(l.old_data || ''), JSON.stringify(l.new_data || '')]);
    });
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
