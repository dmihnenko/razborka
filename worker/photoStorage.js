// Общее хранилище фото razborka.net (Cloudflare R2, binding env.PHOTOS).
// Чистые функции: env и fetchFn передаются явно (тестируются без Workers-рантайма).
// Ключи объектов: c/{companyId}/{uuid}/{full|medium|thumb}.{jpg|webp}

// Потолок веса файла: клиент сжимает до ~200/60/14 КБ, запас на сложные снимки
export const LIMITS = { full: 400 * 1024, medium: 150 * 1024, thumb: 40 * 1024 }
const KEY_RE = /^c\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\/(full|medium|thumb)\.(jpg|webp)$/
const MAX_DELETE = 20

const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

/** Тип по сигнатуре: JPEG / WebP; всё остальное (вкл. SVG) -> null */
export function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' }
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { type: 'image/webp', ext: 'webp' }
  return null
}

/** Проверка JWT через Supabase Auth; возвращает { token, userId } или null */
async function authenticate(request, env, fetchFn) {
  const h = request.headers.get('authorization') || ''
  const m = /^Bearer\s+(\S+)$/i.exec(h)
  if (!m) return null
  try {
    const res = await fetchFn(env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + m[1] },
    })
    if (!res.ok) return null
    const u = await res.json().catch(() => null)
    return u && u.id ? { token: m[1], userId: u.id } : null
  } catch { return null }
}

function rpcCall(env, fetchFn, token, fn, body) {
  return fetchFn(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
}
/** RPC, защищённые серверным секретом воркера (вызов с anon-ключом) */
const secretRpc = (env, fetchFn, fn, body) =>
  rpcCall(env, fetchFn, env.SUPABASE_ANON_KEY, fn, { p_secret: env.PHOTO_WORKER_SECRET, ...body })

const UUID_RE = /^[A-Za-z0-9-]+$/
async function getCompanyId(env, fetchFn, token) {
  const cr = await rpcCall(env, fetchFn, token, 'get_my_parts_company_id', {}).catch(() => null)
  const id = cr && cr.ok ? await cr.json().catch(() => null) : null
  return typeof id === 'string' && UUID_RE.test(id) ? id : null
}

/** Длина тела из заголовка; null если нет/некорректна */
function contentLength(request) {
  const v = request.headers.get('content-length')
  if (v == null || !/^\d+$/.test(v)) return null
  return Number(v)
}

export const MAX_UPLOAD_BODY = 700 * 1024
export const MAX_DELETE_BODY = 16 * 1024
const PUBLIC_ORIGIN = 'https://razborka.net'

export async function handleUpload(request, env, fetchFn = fetch) {
  if (!env.PHOTOS || !env.PHOTO_WORKER_SECRET) return jsonRes({ code: 'STORAGE_UNAVAILABLE' }, 503)
  // Лимит размера ДО разбора тела (память Worker)
  const len = contentLength(request)
  if (len == null || len > MAX_UPLOAD_BODY) return jsonRes({ code: 'FILE_TOO_LARGE' }, 413)
  const auth = await authenticate(request, env, fetchFn)
  if (!auth) return jsonRes({ code: 'UNAUTHORIZED' }, 401)
  const companyId = await getCompanyId(env, fetchFn, auth.token)
  if (!companyId) return jsonRes({ code: 'FORBIDDEN' }, 403)

  let form
  try { form = await request.formData() } catch { return jsonRes({ code: 'BAD_REQUEST' }, 400) }

  const parts = {}
  for (const name of ['full', 'medium', 'thumb']) {
    const f = form.get(name)
    if (!f || typeof f === 'string' || typeof f.arrayBuffer !== 'function') return jsonRes({ code: 'BAD_REQUEST', field: name }, 400)
    if (f.size > LIMITS[name]) return jsonRes({ code: 'FILE_TOO_LARGE', field: name }, 413)
    const buf = new Uint8Array(await f.arrayBuffer())
    if (buf.length > LIMITS[name]) return jsonRes({ code: 'FILE_TOO_LARGE', field: name }, 413)
    const kind = sniffImage(buf)
    if (!kind) return jsonRes({ code: 'UNSUPPORTED_TYPE', field: name }, 415)
    parts[name] = { buf, ...kind }
  }

  const id = crypto.randomUUID()
  const names = ['full', 'medium', 'thumb']
  const keys = names.map((n) => `c/${companyId}/${id}/${n}.${parts[n].ext}`)
  const items = names.map((n, i) => ({ key: keys[i], size: parts[n].buf.length }))

  const rs = await secretRpc(env, fetchFn, 'photo_register', { p_user: auth.userId, p_items: items }).catch(() => null)
  if (!rs) return jsonRes({ code: 'SERVER_ERROR' }, 502)
  if (!rs.ok) {
    const txt = await rs.text().catch(() => '')
    if (txt.includes('PHOTO_QUOTA_EXCEEDED')) return jsonRes({ code: 'PHOTO_QUOTA_EXCEEDED' }, 413)
    return jsonRes({ code: 'SERVER_ERROR' }, 502)
  }
  const regCompany = await rs.json().catch(() => null)
  if (regCompany !== companyId) {
    await secretRpc(env, fetchFn, 'photo_unregister', { p_user: auth.userId, p_keys: keys }).catch(() => {})
    return jsonRes({ code: 'SERVER_ERROR' }, 502)
  }

  const written = []
  try {
    for (let i = 0; i < names.length; i++) {
      await env.PHOTOS.put(keys[i], parts[names[i]].buf, { httpMetadata: { contentType: parts[names[i]].type } })
      written.push(keys[i])
    }
  } catch {
    try { if (written.length) await env.PHOTOS.delete(written) } catch { /* best effort */ }
    await secretRpc(env, fetchFn, 'photo_unregister', { p_user: auth.userId, p_keys: keys }).catch(() => {})
    return jsonRes({ code: 'STORAGE_WRITE_FAILED' }, 502)
  }

  const u = (i) => `${PUBLIC_ORIGIN}/photos/${keys[i]}`
  return jsonRes({ url: u(0), medium_url: u(1), thumb_url: u(2), delete_url: '' })
}

export async function handleGet(request, env, ctx) {
  const url = new URL(request.url)
  let key
  try { key = decodeURIComponent(url.pathname.slice('/photos/'.length)) } catch { return notFound() }
  if (!KEY_RE.test(key)) return notFound()
  if (!env.PHOTOS) return notFound()
  // Кеш на сервере Cloudflare: повторные просмотры не тратят операции чтения R2
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(`${PUBLIC_ORIGIN}/photos/${key}`, { method: 'GET' })
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit
  }
  const obj = await env.PHOTOS.get(key)
  if (!obj) return notFound()
  const headers = new Headers({
    'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  if (obj.httpEtag) headers.set('etag', obj.httpEtag)
  if (obj.size != null) headers.set('content-length', String(obj.size))
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  const res = new Response(obj.body, { status: 200, headers })
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' } })

export async function handleDelete(request, env, fetchFn = fetch) {
  if (!env.PHOTOS || !env.PHOTO_WORKER_SECRET) return jsonRes({ code: 'STORAGE_UNAVAILABLE' }, 503)
  const len = contentLength(request)
  if (len == null || len > MAX_DELETE_BODY) return jsonRes({ code: 'BAD_REQUEST' }, 413)
  const auth = await authenticate(request, env, fetchFn)
  if (!auth) return jsonRes({ code: 'UNAUTHORIZED' }, 401)
  let body = null
  try {
    const txt = await request.text()
    if (txt.length > MAX_DELETE_BODY) return jsonRes({ code: 'BAD_REQUEST' }, 413)
    body = JSON.parse(txt)
  } catch { body = null }
  const urls = body && Array.isArray(body.urls) ? body.urls : null
  if (!urls || urls.length > MAX_DELETE) return jsonRes({ code: 'BAD_REQUEST' }, 400)

  const keys = new Set()
  for (const raw of urls) {
    try {
      const p = new URL(String(raw), request.url).pathname
      if (!p.startsWith('/photos/')) continue
      const key = decodeURIComponent(p.slice('/photos/'.length))
      if (KEY_RE.test(key)) keys.add(key)
    } catch { /* пропуск */ }
  }
  if (!keys.size) return jsonRes({ deleted: 0 })

  // Сервер сам оставляет только объекты компании пользователя и возвращает реально снятые ключи
  const rs = await secretRpc(env, fetchFn, 'photo_unregister', { p_user: auth.userId, p_keys: [...keys] }).catch(() => null)
  if (!rs || !rs.ok) return jsonRes({ code: 'SERVER_ERROR' }, 502)
  const removed = await rs.json().catch(() => null)
  if (!Array.isArray(removed)) return jsonRes({ code: 'SERVER_ERROR' }, 502)
  const toDelete = removed.filter((k) => keys.has(k))
  try { if (toDelete.length) await env.PHOTOS.delete(toDelete) } catch { /* регистрация снята, файл-сирота безвреден */ }
  return jsonRes({ deleted: toDelete.length })
}

export const isPhotosGet = (p, method) => p.startsWith('/photos/') && (method === 'GET' || method === 'HEAD')
