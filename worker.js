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
    const db = env.DB || env.sothuchi_db;

    if (!db) {
      return jsonResponse({ status: 'error', message: 'D1 Database binding (DB hoặc sothuchi_db) chưa được cấu hình trong wrangler.toml' }, 500);
    }

    try {
      // 1. Health check & Ping
      if (path === '/api/ping' || action === 'ping' || path === '/') {
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
      if (path === '/api/syncBatch' || request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const transactions = body.transactions || [];
        const categories = body.categories || [];
        const statements = [];
        const syncedIds = [];

        // Transaction Upserts & Deletes
        for (const tx of transactions) {
          if (tx.sync_status === 'pending_delete') {
            statements.push(
              db.prepare('DELETE FROM transactions WHERE id = ?').bind(tx.id)
            );
            syncedIds.push(tx.id);
          } else if (tx.sync_status === 'pending_add' || tx.sync_status === 'pending_update') {
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
