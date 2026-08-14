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
        const assets = await db.prepare('SELECT * FROM assets').all().catch(() => ({ results: [] }));
        const liabilities = await db.prepare('SELECT * FROM liabilities').all().catch(() => ({ results: [] }));
        const loans = await db.prepare('SELECT * FROM loans').all().catch(() => ({ results: [] }));
        const recurring = await db.prepare('SELECT * FROM recurring').all().catch(() => ({ results: [] }));

        return jsonResponse({
          status: 'success',
          transactions: txs.results || [],
          categories: cats.results || [],
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
        const assets = body.assets || [];
        const liabilities = body.liabilities || [];
        const loans = body.loans || [];
        const statements = [];
        const syncedIds = [];

        // Transaction Upserts & Deletes
        for (const tx of transactions) {
          if (tx.sync_status === 'pending_delete') {
            statements.push(
              db.prepare('DELETE FROM transactions WHERE id = ?').bind(tx.id)
            );
            syncedIds.push(tx.id);
          } else if (tx.sync_status === 'pending_add' || tx.sync_status === 'pending_update' || tx.sync_status === 'synced') {
            statements.push(
              db.prepare(`
                INSERT INTO transactions (id, date, type, category, amount, note, created_at, updated_at, sync_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
                ON CONFLICT(id) DO UPDATE SET
                  date = excluded.date,
                  type = excluded.type,
                  category = excluded.category,
                  amount = excluded.amount,
                  note = excluded.note,
                  updated_at = excluded.updated_at,
                  sync_status = 'synced'
              `).bind(
                String(tx.id),
                String(tx.date),
                String(tx.type),
                String(tx.category),
                Number(tx.amount) || 0,
                String(tx.note || ''),
                String(tx.created_at || new Date().toISOString()),
                String(tx.updated_at || new Date().toISOString())
              )
            );
            syncedIds.push(tx.id);
          }
        }

        // Category Upserts
        for (const cat of categories) {
          if (cat.name) {
            statements.push(
              db.prepare(`
                INSERT INTO categories (id, name, type, icon, color, is_hidden, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  icon = excluded.icon,
                  color = excluded.color,
                  is_hidden = excluded.is_hidden,
                  sort_order = excluded.sort_order
              `).bind(
                String(cat.id || 'cat_' + Date.now()),
                String(cat.name),
                String(cat.type || 'expense'),
                String(cat.icon || '📁'),
                String(cat.color || '#4f46e5'),
                cat.is_hidden ? 1 : 0,
                Number(cat.sort_order) || 0
              )
            );
          }
        }

        // Assets Upserts
        for (const a of assets) {
          if (a.name) {
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
          }
        }

        // Liabilities Upserts
        for (const l of liabilities) {
          if (l.name) {
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
                Number(l.total_debt || l.remaining_debt) || 0,
                Number(l.remaining_debt) || 0,
                String(l.note || ''),
                String(l.updated_at || new Date().toISOString())
              )
            );
          }
        }

        // Loans Upserts
        for (const loan of loans) {
          if (loan.person_name) {
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
          }
        }

        if (statements.length > 0) {
          await db.batch(statements);
        }

        // Fetch remote updates
        const allRemote = await db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all();

        return jsonResponse({
          status: 'success',
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
