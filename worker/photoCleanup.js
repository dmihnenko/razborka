// Регулярная уборка общего хранилища фото (R2). Крон "15 3 * * *".
// (а) сироты по базе (нет ссылок ни в одной таблице) -> удалить из R2 -> снять регистрацию;
// (б) файлы R2 без записи в базе (регистрация не прошла) старше 3 дней -> удалить;
// (в) пересчёт used_bytes.

export const MIN_AGE_MS = 3 * 24 * 3600 * 1000
export const MAX_DELETES = 2000
export const MAX_LIST_PAGES = 5
const ORPHAN_BATCH = 500
const DELETE_CHUNK = 1000

async function rpc(env, fetchFn, fn, body) {
  const res = await fetchFn(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: env.PHOTO_WORKER_SECRET, ...body }),
  })
  if (!res.ok) throw new Error(`${fn} ${res.status}`)
  return res.json()
}

/** Удаляет ключи из R2 пачками; возвращает реально удалённые (упавшая пачка пропускается) */
async function deleteFromR2(env, keys) {
  const done = []
  for (let i = 0; i < keys.length; i += DELETE_CHUNK) {
    const chunk = keys.slice(i, i + DELETE_CHUNK)
    try { await env.PHOTOS.delete(chunk); done.push(...chunk) } catch { /* повторим в след. запуск */ }
  }
  return done
}

export async function cleanupPhotos(env, fetchFn = fetch, now = Date.now()) {
  if (!env || !env.PHOTOS || !env.PHOTO_WORKER_SECRET) return null
  const stat = { orphans: 0, purged: 0, strays: 0, recomputed: 0 }
  let budget = MAX_DELETES

  // (а) сироты из базы
  try {
    while (budget > 0) {
      const rows = await rpc(env, fetchFn, 'photo_orphans', { p_min_age: '3 days', p_limit: Math.min(ORPHAN_BATCH, budget) })
      const keys = Array.isArray(rows) ? rows.map((r) => r.key).filter(Boolean) : []
      if (!keys.length) break
      stat.orphans += keys.length
      const deleted = await deleteFromR2(env, keys)
      if (!deleted.length) break
      budget -= deleted.length
      const n = await rpc(env, fetchFn, 'photo_purge', { p_keys: deleted })
      stat.purged += Number(n) || 0
      if (keys.length < ORPHAN_BATCH) break
    }
  } catch (e) { console.log('photoCleanup orphans error', String(e && e.message || e)) }

  // (б) файлы R2 без записи в базе
  try {
    let cursor
    for (let page = 0; page < MAX_LIST_PAGES && budget > 0; page++) {
      const l = await env.PHOTOS.list({ prefix: 'c/', cursor, limit: 1000 })
      const old = (l.objects || []).filter((o) => o.uploaded && now - new Date(o.uploaded).getTime() > MIN_AGE_MS).map((o) => o.key)
      if (old.length) {
        const known = new Set(await rpc(env, fetchFn, 'photo_known_keys', { p_keys: old }))
        const stray = old.filter((k) => !known.has(k)).slice(0, budget)
        if (stray.length) {
          const deleted = await deleteFromR2(env, stray)
          stat.strays += deleted.length
          budget -= deleted.length
        }
      }
      if (!l.truncated) break
      cursor = l.cursor
    }
  } catch (e) { console.log('photoCleanup strays error', String(e && e.message || e)) }

  // (в) самовосстановление счётчика
  try { stat.recomputed = Number(await rpc(env, fetchFn, 'photo_recompute_usage', {})) || 0 } catch (e) { console.log('photoCleanup recompute error', String(e && e.message || e)) }

  console.log(`photoCleanup orphans=${stat.orphans} purged=${stat.purged} strays=${stat.strays} recomputed=${stat.recomputed}`)
  return stat
}
