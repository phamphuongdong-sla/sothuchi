/**
 * Code.gs - Google Apps Script Web App Endpoint Backend
 * Standard 8-column Google Sheets Backend for Sổ Thu Chi Cá Nhân (PWA).
 * 
 * Column Schema:
 * [ID, Ngày, Loại, Hạng mục, Số tiền, Ghi chú, Thời gian tạo, Thời gian cập nhật]
 */

const SHEET_NAME = 'GiaoDich';
const HEADERS = ['ID', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Ghi chú', 'Thời gian tạo', 'Thời gian cập nhật'];

/**
 * Handle HTTP GET Requests
 * Actions: ping, fetchAll
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

      return responseJSON({
        status: 'success',
        transactions: transactions,
        categories: []
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
 * Actions: syncBatch
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
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return responseJSON({ status: 'error', message: 'Malformed JSON payload: ' + parseErr.toString() });
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
          if (rowIdx !== -1) {
            sheet.deleteRow(rowIdx);
          }
          syncedIds.push(tx.id);
        } else if (rowIdx !== -1) {
          // Update existing row
          sheet.getRange(rowIdx, 1, 1, 8).setValues([[
            tx.id,
            dateVal,
            tx.type || 'expense',
            tx.category || 'Khác',
            Number(tx.amount) || 0,
            tx.note || '',
            createdAt,
            updatedAt
          ]]);
          syncedIds.push(tx.id);
        } else {
          // Append new row
          sheet.appendRow([
            tx.id,
            dateVal,
            tx.type || 'expense',
            tx.category || 'Khác',
            Number(tx.amount) || 0,
            tx.note || '',
            createdAt,
            updatedAt
          ]);
          syncedIds.push(tx.id);
        }
      });

      return responseJSON({
        status: 'success',
        synced_ids: syncedIds
      });
    }

    return responseJSON({ status: 'error', message: 'Unsupported POST action: ' + payload.action });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Get or create Spreadsheet sheet with header auto-initialization
 */
function getOrCreateSheet() {
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }
  if (!ss) return new MockSheet();

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

/**
 * Find 1-indexed row index by Transaction ID
 */
function findRowIndexById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Format date string
 */
function formatDate(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val).split('T')[0];
}

/**
 * Helper to construct JSON response with proper MimeType
 */
function responseJSON(obj) {
  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return obj;
}

/**
 * MockSheet fallback for isolated testing
 */
function MockSheet() {
  this.rows = [HEADERS];
  this.getDataRange = function() {
    return { getValues: () => this.rows };
  };
  this.appendRow = function(row) {
    this.rows.push(row);
  };
  this.deleteRow = function(idx) {
    this.rows.splice(idx - 1, 1);
  };
  this.getLastRow = function() {
    return this.rows.length;
  };
  this.getRange = function(r, c, nr, nc) {
    return {
      setValues: (vals) => {
        this.rows[r - 1] = vals[0];
      }
    };
  };
}
