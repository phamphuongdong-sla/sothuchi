/**
 * Cloudflare Workers + D1 SQLite Backend for Sổ Thu Chi Cá Nhân
 * Free Tier: 5GB DB Storage, 5 Million Reads/day, 100k Writes/day
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

export async function executeBatchSafe(db, statements, chunkSize = 80) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await db.batch(chunk);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const action = url.searchParams.get('action');

    // 0. Phục vụ Giao diện PWA (Static Assets) nếu truy cập qua trình duyệt công cộng
    if (env.ASSETS && !path.startsWith('/api/') && !action) {
      const assetRes = await env.ASSETS.fetch(request).catch(() => null);
      if (assetRes && assetRes.status !== 404) {
        return assetRes;
      }
    }

    const db = env.DB || env.sothuchi_db;
    if (!db) {
      return jsonResponse({ status: 'error', message: 'D1 Database binding (DB hoặc sothuchi_db) chưa được cấu hình trong wrangler.toml' }, 500);
    }

    try {
      // 1. Health check & Ping (chỉ cho /api/ping hoặc action=ping)
      if (path === '/api/ping' || action === 'ping' || (path === '/' && request.headers.get('accept')?.includes('json'))) {
        // Test query D1
        const countRes = await db.prepare('SELECT COUNT(*) as count FROM transactions').first().catch(() => null);
        return jsonResponse({
          status: 'ok',
          backend: 'Cloudflare D1 SQLite',
          version: '2.0',
          transaction_count: countRes ? countRes.count : 0
        });
      }

      // 2. Fetch All Data
      if (path === '/api/fetchAll' || action === 'fetchAll') {
        const txs = await db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all();
        const cats = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        const wallets = await db.prepare('SELECT * FROM wallets ORDER BY is_default DESC').all().catch(() => ({ results: [] }));
        const assets = await db.prepare('SELECT * FROM assets').all().catch(() => ({ results: [] }));
        const liabilities = await db.prepare('SELECT * FROM liabilities').all().catch(() => ({ results: [] }));
        const loans = await db.prepare('SELECT * FROM loans').all().catch(() => ({ results: [] }));
        const recurring = await db.prepare('SELECT * FROM recurring').all().catch(() => ({ results: [] }));

        return jsonResponse({
          status: 'success',
          transactions: txs.results || [],
          categories: cats.results || [],
          wallets: wallets.results || [],
          assets: assets.results || [],
          liabilities: liabilities.results || [],
          loans: loans.results || [],
          recurring: recurring.results || []
        });
      }

      // 3. Batch Sync (Push & Pull)
      if (path === '/api/syncBatch' || action === 'syncBatch' || request.method === 'POST') {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        } else {
          const payloadParam = url.searchParams.get('payload');
          if (payloadParam) {
            try { body = JSON.parse(decodeURIComponent(payloadParam)); } catch (_) {}
          }
        }

        const transactions = body.transactions || [];
        const categories = body.categories || [];
        const wallets = body.wallets || [];
        const assets = body.assets || [];
        const liabilities = body.liabilities || [];
        const loans = body.loans || [];
        const recurring = body.recurring || [];
        const auditLogs = body.audit_logs || body.auditLogs || [];
        const statements = [];
        const syncedIds = [];

        // Transaction Upserts & Deletes
        for (const tx of transactions) {
          if (tx.sync_status === 'pending_delete' || tx.is_deleted || tx.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM transactions WHERE id = ?').bind(tx.id)
            );
            syncedIds.push(tx.id);
          } else if (tx.sync_status === 'pending_add' || tx.sync_status === 'pending_update' || tx.sync_status === 'synced' || tx.id) {
            statements.push(
              db.prepare(`
                INSERT INTO transactions (id, date, type, category, amount, note, wallet_id, wallet_name, created_at, updated_at, sync_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
                ON CONFLICT(id) DO UPDATE SET
                  date = excluded.date,
                  type = excluded.type,
                  category = excluded.category,
                  amount = excluded.amount,
                  note = excluded.note,
                  wallet_id = excluded.wallet_id,
                  wallet_name = excluded.wallet_name,
                  updated_at = excluded.updated_at,
                  sync_status = 'synced'
              `).bind(
                String(tx.id),
                String(tx.date),
                String(tx.type),
                String(tx.category),
                Number(tx.amount) || 0,
                String(tx.note || ''),
                String(tx.wallet_id || 'wallet_cash'),
                String(tx.wallet_name || 'Ví tiền mặt'),
                String(tx.created_at || new Date().toISOString()),
                String(tx.updated_at || new Date().toISOString())
              )
            );
            syncedIds.push(tx.id);
          }
        }

        // Wallets Upserts & Deletes
        for (const w of wallets) {
          if (w.sync_status === 'pending_delete' || w.is_deleted || w.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM wallets WHERE id = ?').bind(w.id)
            );
            syncedIds.push(w.id);
          } else if (w.name) {
            statements.push(
              db.prepare(`
                INSERT INTO wallets (id, name, type, icon, color, initial_balance, balance, is_default, is_hidden)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  icon = excluded.icon,
                  color = excluded.color,
                  initial_balance = excluded.initial_balance,
                  balance = excluded.balance,
                  is_default = excluded.is_default,
                  is_hidden = excluded.is_hidden
              `).bind(
                String(w.id || 'wallet_' + Date.now()),
                String(w.name),
                String(w.type || 'cash'),
                String(w.icon || '💵'),
                String(w.color || '#10b981'),
                Number(w.initial_balance !== undefined ? w.initial_balance : w.balance) || 0,
                Number(w.balance) || 0,
                w.is_default ? 1 : 0,
                w.is_hidden ? 1 : 0
              )
            );
            syncedIds.push(w.id);
          }
        }

        // Category Upserts & Deletes
        for (const cat of categories) {
          if (cat.sync_status === 'pending_delete' || cat.is_deleted || cat.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM categories WHERE id = ?').bind(cat.id)
            );
            syncedIds.push(cat.id);
          } else if (cat.name) {
            statements.push(
              db.prepare(`
                INSERT INTO categories (id, name, type, icon, color, group_name, group_id, is_hidden, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  icon = excluded.icon,
                  color = excluded.color,
                  group_name = excluded.group_name,
                  group_id = excluded.group_id,
                  is_hidden = excluded.is_hidden,
                  sort_order = excluded.sort_order
              `).bind(
                String(cat.id || 'cat_' + Date.now()),
                String(cat.name),
                String(cat.type || 'expense'),
                String(cat.icon || '📁'),
                String(cat.color || '#4f46e5'),
                String(cat.group_name || cat.group || ''),
                String(cat.group_id || cat.groupId || ''),
                cat.is_hidden ? 1 : 0,
                Number(cat.sort_order) || 0
              )
            );
            syncedIds.push(cat.id);
          }
        }

        // Assets Upserts & Deletes
        for (const a of assets) {
          if (a.sync_status === 'pending_delete' || a.is_deleted || a.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM assets WHERE id = ?').bind(a.id)
            );
            syncedIds.push(a.id);
          } else if (a.name) {
            statements.push(
              db.prepare(`
                INSERT INTO assets (id, name, category, value, note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  category = excluded.category,
                  value = excluded.value,
                  note = excluded.note,
                  updated_at = excluded.updated_at
              `).bind(
                String(a.id),
                String(a.name),
                String(a.category || 'Tài khoản ngân hàng'),
                Number(a.value) || 0,
                String(a.note || ''),
                String(a.updated_at || new Date().toISOString())
              )
            );
            syncedIds.push(a.id);
          }
        }

        // Liabilities Upserts & Deletes
        for (const l of liabilities) {
          if (l.sync_status === 'pending_delete' || l.is_deleted || l.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM liabilities WHERE id = ?').bind(l.id)
            );
            syncedIds.push(l.id);
          } else if (l.name) {
            statements.push(
              db.prepare(`
                INSERT INTO liabilities (id, name, category, total_debt, remaining_debt, note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  category = excluded.category,
                  total_debt = excluded.total_debt,
                  remaining_debt = excluded.remaining_debt,
                  note = excluded.note,
                  updated_at = excluded.updated_at
              `).bind(
                String(l.id),
                String(l.name),
                String(l.category || 'Thẻ tín dụng'),
                Number(l.total_debt !== undefined ? l.total_debt : l.remaining_debt) || 0,
                Number(l.remaining_debt) || 0,
                String(l.note || ''),
                String(l.updated_at || new Date().toISOString())
              )
            );
            syncedIds.push(l.id);
          }
        }

        // Loans Upserts & Deletes
        for (const loan of loans) {
          if (loan.sync_status === 'pending_delete' || loan.is_deleted || loan.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM loans WHERE id = ?').bind(loan.id)
            );
            syncedIds.push(loan.id);
          } else if (loan.person_name) {
            statements.push(
              db.prepare(`
                INSERT INTO loans (id, type, person_name, original_amount, remaining_amount, due_date, note, status, repayments_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  type = excluded.type,
                  person_name = excluded.person_name,
                  original_amount = excluded.original_amount,
                  remaining_amount = excluded.remaining_amount,
                  due_date = excluded.due_date,
                  note = excluded.note,
                  status = excluded.status,
                  repayments_json = excluded.repayments_json,
                  updated_at = excluded.updated_at
              `).bind(
                String(loan.id),
                String(loan.type || 'loan'),
                String(loan.person_name),
                Number(loan.original_amount) || 0,
                Number(loan.remaining_amount) || 0,
                String(loan.due_date || ''),
                String(loan.note || ''),
                String(loan.status || 'active'),
                String(typeof loan.repayments === 'string' ? loan.repayments : JSON.stringify(loan.repayments || [])),
                String(loan.updated_at || new Date().toISOString())
              )
            );
            syncedIds.push(loan.id);
          }
        }

        // Recurring Upserts & Deletes
        for (const r of recurring) {
          if (r.sync_status === 'pending_delete' || r.is_deleted || r.action === 'delete') {
            statements.push(
              db.prepare('DELETE FROM recurring WHERE id = ?').bind(r.id)
            );
            syncedIds.push(r.id);
          } else if (r.category || r.type || r.id) {
            statements.push(
              db.prepare(`
                INSERT INTO recurring (id, type, amount, category, wallet_id, note, frequency, day_of_month, last_run_date, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  type = excluded.type,
                  amount = excluded.amount,
                  category = excluded.category,
                  wallet_id = excluded.wallet_id,
                  note = excluded.note,
                  frequency = excluded.frequency,
                  day_of_month = excluded.day_of_month,
                  last_run_date = excluded.last_run_date,
                  is_active = excluded.is_active
              `).bind(
                String(r.id || 'rec_' + Date.now()),
                String(r.type || 'expense'),
                Number(r.amount) || 0,
                String(r.category || ''),
                String(r.wallet_id || 'wallet_cash'),
                String(r.note || ''),
                String(r.frequency || 'monthly'),
                Number(r.day_of_month) || 1,
                String(r.last_run_date || ''),
                r.is_active !== undefined ? (r.is_active ? 1 : 0) : 1
              )
            );
            syncedIds.push(r.id);
          }
        }

        // Audit Logs Inserts
        for (const log of auditLogs) {
          if (log.id && log.action) {
            statements.push(
              db.prepare(`
                INSERT INTO audit_logs (id, timestamp, action, entity_type, entity_id, old_data_json, new_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `).bind(
                String(log.id),
                String(log.timestamp || new Date().toISOString()),
                String(log.action),
                String(log.entity_type || log.entityType || 'transaction'),
                String(log.entity_id || log.entityId || ''),
                typeof log.old_data_json === 'string' ? log.old_data_json : (log.old_data_json ? JSON.stringify(log.old_data_json) : (log.oldData ? JSON.stringify(log.oldData) : null)),
                typeof log.new_data_json === 'string' ? log.new_data_json : (log.new_data_json ? JSON.stringify(log.new_data_json) : (log.newData ? JSON.stringify(log.newData) : null))
              )
            );
            syncedIds.push(log.id);
          }
        }

        if (statements.length > 0) {
          await executeBatchSafe(db, statements, 80);
        }

        // Fetch remote updates
        const allRemote = await db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all();

        return jsonResponse({
          status: 'success',
          success: true,
          synced_count: syncedIds.length,
          synced_ids: syncedIds,
          remote_updates: allRemote.results || []
        });
      }

      return jsonResponse({ status: 'error', message: 'Endpoint không tồn tại' }, 404);
    } catch (err) {
      return jsonResponse({ status: 'error', message: err.message || String(err) }, 500);
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}
