import { describe, it, expect, vi } from 'vitest'
import { handleUpload, handleGet, handleDelete, LIMITS } from './photoStorage.js'

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', PHOTO_WORKER_SECRET: 'sec' }
const CID = '11111111-1111-1111-1111-111111111111'
const JPEG = (n) => { const b = new Uint8Array(n); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b }

function fakeBucket({ failOn } = {}) {
  const m = new Map(); let puts = 0
  return {
    m,
    put: vi.fn(async (k, v, o) => { if (failOn && ++puts === failOn) throw new Error('boom'); m.set(k, { v, o }) }),
    delete: vi.fn(async (k) => { for (const x of [].concat(k)) m.delete(x) }),
    head: vi.fn(async (k) => (m.has(k) ? { size: m.get(k).v.length } : null)),
    get: vi.fn(async (k) => (m.has(k) ? { body: 'BODY', size: m.get(k).v.length, httpEtag: '"e"', httpMetadata: { contentType: m.get(k).o.httpMetadata.contentType } } : null)),
  }
}
// fetchFn: auth ok, rpc по имени; photo_* имитируют реестр объектов (двойное снятие ничего не возвращает)
function mkFetch({ authOk = true, register = { ok: true }, company = CID } = {}) {
  const registry = new Map()
  const f = vi.fn(async (url, init) => {
    if (url.endsWith('/auth/v1/user')) return authOk ? new Response(JSON.stringify({ id: 'u1' })) : new Response('{}', { status: 401 })
    if (url.endsWith('/photo_register')) {
      if (!register.ok) return new Response('{"message":"PHOTO_QUOTA_EXCEEDED"}', { status: 400 })
      for (const it of JSON.parse(init.body).p_items) registry.set(it.key, it.size)
      return new Response(JSON.stringify(company))
    }
    if (url.endsWith('/photo_unregister')) {
      const { p_keys } = JSON.parse(init.body)
      const out = p_keys.filter((k) => registry.delete(k))
      return new Response(JSON.stringify(out))
    }
    if (url.endsWith('/get_my_parts_company_id')) return new Response(JSON.stringify(company))
    return new Response('null')
  })
  f.registry = registry
  return f
}
const rpcs = (f, name) => f.mock.calls.filter((c) => c[0].endsWith('/' + name))

// multipart собираем вручную: в jsdom-окружении FormData/Blob не совместимы с Request из undici
function uploadReq({ token = 't', clen, full = JPEG(100), medium = JPEG(50), thumb = JPEG(20) } = {}) {
  const B = '----t'
  const N = String.fromCharCode(13, 10)
  const enc = new TextEncoder()
  const chunks = []
  for (const [name, bytes] of [['full', full], ['medium', medium], ['thumb', thumb]]) {
    chunks.push(enc.encode(`--${B}${N}Content-Disposition: form-data; name="${name}"; filename="${name}.jpg"${N}Content-Type: image/jpeg${N}${N}`), bytes, enc.encode(N))
  }
  chunks.push(enc.encode(`--${B}--${N}`))
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of chunks) { body.set(c, o); o += c.length }
  const headers = { 'content-type': `multipart/form-data; boundary=${B}` }
  if (token) headers.authorization = 'Bearer ' + token
  // clen === null -> заголовка нет; undefined -> реальная длина
  if (clen !== null) headers['content-length'] = String(clen ?? body.length)
  return new Request('https://razborka.net/api/photos/upload', { method: 'POST', body, headers })
}

describe('upload', () => {
  it('без токена 401', async () => {
    const r = await handleUpload(uploadReq({ token: null }), { ...ENV, PHOTOS: fakeBucket() }, mkFetch())
    expect(r.status).toBe(401)
  })
  it('невалидный токен 401', async () => {
    const r = await handleUpload(uploadReq(), { ...ENV, PHOTOS: fakeBucket() }, mkFetch({ authOk: false }))
    expect(r.status).toBe(401)
  })
  it('нет бакета 503', async () => {
    const r = await handleUpload(uploadReq(), ENV, mkFetch())
    expect(r.status).toBe(503)
    expect((await r.json()).code).toBe('STORAGE_UNAVAILABLE')
  })
  it('нет секрета воркера 503, ничего не пишем', async () => {
    const b = fakeBucket()
    const f = mkFetch()
    const r = await handleUpload(uploadReq(), { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: 'anon', PHOTOS: b }, f)
    expect(r.status).toBe(503)
    expect(b.put).not.toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
  })
  it('большой или отсутствующий Content-Length 413 до разбора тела', async () => {
    for (const clen of [7 * 1024 * 1024, null]) {
      const req = uploadReq({ clen })
      const spy = vi.spyOn(req, 'formData')
      const f = mkFetch()
      const r = await handleUpload(req, { ...ENV, PHOTOS: fakeBucket() }, f)
      expect(r.status).toBe(413)
      expect(spy).not.toHaveBeenCalled()
      expect(f).not.toHaveBeenCalled()
    }
  })
  it('нет компании 403 до разбора тела', async () => {
    const req = uploadReq()
    const spy = vi.spyOn(req, 'formData')
    const r = await handleUpload(req, { ...ENV, PHOTOS: fakeBucket() }, mkFetch({ company: null }))
    expect(r.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })
  it('успех: ключи c/{company}/ и абсолютные URL razborka.net, секрет в photo_register', async () => {
    const b = fakeBucket()
    const f = mkFetch()
    const r = await handleUpload(uploadReq(), { ...ENV, PHOTOS: b }, f)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.url).toMatch(new RegExp(`^https://razborka.net/photos/c/${CID}/[0-9a-f-]+/full\\.jpg$`))
    expect(j.medium_url).toContain('/medium.jpg')
    expect(j.thumb_url).toContain('/thumb.jpg')
    expect(j.delete_url).toBe('')
    expect(b.m.size).toBe(3)
    expect([...b.m.values()][0].o.httpMetadata.contentType).toBe('image/jpeg')
    const reg = JSON.parse(rpcs(f, 'photo_register')[0][1].body)
    expect(reg.p_secret).toBe('sec')
    expect(reg.p_user).toBe('u1')
    expect(reg.p_items.every((i) => i.key.startsWith(`c/${CID}/`))).toBe(true)
    expect(reg.p_items.map((i) => i.size)).toEqual([100, 50, 20])
  })
  it('плохая сигнатура 415 (SVG)', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    const f = mkFetch()
    const r = await handleUpload(uploadReq({ full: svg }), { ...ENV, PHOTOS: fakeBucket() }, f)
    expect(r.status).toBe(415)
    expect(rpcs(f, 'photo_register')).toHaveLength(0)
  })
  it('большой файл 413 FILE_TOO_LARGE', async () => {
    const r = await handleUpload(uploadReq({ thumb: JPEG(LIMITS.thumb + 1) }), { ...ENV, PHOTOS: fakeBucket() }, mkFetch())
    expect(r.status).toBe(413)
    expect((await r.json()).code).toBe('FILE_TOO_LARGE')
  })
  it('превышение лимита 413 PHOTO_QUOTA_EXCEEDED, ничего не пишем', async () => {
    const b = fakeBucket()
    const r = await handleUpload(uploadReq(), { ...ENV, PHOTOS: b }, mkFetch({ register: { ok: false } }))
    expect(r.status).toBe(413)
    expect((await r.json()).code).toBe('PHOTO_QUOTA_EXCEEDED')
    expect(b.put).not.toHaveBeenCalled()
  })
  it('сбой записи: удаляем записанное и photo_unregister', async () => {
    const b = fakeBucket({ failOn: 3 })
    const f = mkFetch()
    const r = await handleUpload(uploadReq(), { ...ENV, PHOTOS: b }, f)
    expect(r.status).toBe(502)
    expect(b.m.size).toBe(0)
    expect(rpcs(f, 'photo_register')).toHaveLength(1)
    expect(rpcs(f, 'photo_unregister')).toHaveLength(1)
    expect(f.registry.size).toBe(0)
  })
})

describe('GET /photos', () => {
  const key = `c/${CID}/abc-123/full.jpg`
  const req = (p, m = 'GET') => new Request('https://razborka.net/photos/' + p, { method: m })
  it('отдаёт с иммутабельным кэшем', async () => {
    const b = fakeBucket(); b.m.set(key, { v: JPEG(10), o: { httpMetadata: { contentType: 'image/jpeg' } } })
    const r = await handleGet(req(key), { PHOTOS: b })
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('etag')).toBe('"e"')
    expect(r.headers.get('content-type')).toBe('image/jpeg')
  })
  it('нет объекта 404 no-store; чужой префикс/traversal 404', async () => {
    const b = fakeBucket()
    const r = await handleGet(req(key), { PHOTOS: b })
    expect(r.status).toBe(404)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect((await handleGet(req('x/' + CID + '/a/full.jpg'), { PHOTOS: b })).status).toBe(404)
    expect((await handleGet(req('c/../../etc/full.jpg'), { PHOTOS: b })).status).toBe(404)
    expect(b.get).toHaveBeenCalledTimes(1)
  })
})

describe('delete', () => {
  const mine = `c/${CID}/aaa/full.jpg`
  const other = 'c/22222222-2222-2222-2222-222222222222/bbb/full.jpg'
  const dreq = (urls, token = 't', extra = {}) => {
    const body = JSON.stringify({ urls })
    return new Request('https://razborka.net/api/photos/delete', {
      method: 'POST', body,
      headers: { 'content-length': String(body.length), ...(token ? { authorization: 'Bearer ' + token } : {}), ...extra },
    })
  }
  const seed = () => {
    const b = fakeBucket()
    for (const k of [mine, other]) b.m.set(k, { v: JPEG(100), o: { httpMetadata: { contentType: 'image/jpeg' } } })
    return b
  }
  // реестр: сервер знает только «свои» объекты пользователя
  const seedFetch = () => { const f = mkFetch(); f.registry.set(mine, 100); return f }
  it('без токена 401', async () => {
    expect((await handleDelete(dreq([mine], null), { ...ENV, PHOTOS: seed() }, mkFetch())).status).toBe(401)
  })
  it('нет секрета 503', async () => {
    const r = await handleDelete(dreq([mine]), { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_ANON_KEY: 'anon', PHOTOS: seed() }, mkFetch())
    expect(r.status).toBe(503)
  })
  it('чужой префикс: из R2 удаляется только вернувшееся из photo_unregister', async () => {
    const b = seed(); const f = seedFetch()
    const r = await handleDelete(dreq(['https://razborka.net/photos/' + mine, '/photos/' + other, 'https://imgbb/x.jpg']), { ...ENV, PHOTOS: b }, f)
    expect((await r.json()).deleted).toBe(1)
    expect(b.m.has(mine)).toBe(false)
    expect(b.m.has(other)).toBe(true)
  })
  it('двойное удаление: второй раз ничего не снимается и R2 не трогается', async () => {
    const b = seed(); const f = seedFetch()
    const env = { ...ENV, PHOTOS: b }
    expect((await (await handleDelete(dreq(['/photos/' + mine]), env, f)).json()).deleted).toBe(1)
    b.delete.mockClear()
    expect((await (await handleDelete(dreq(['/photos/' + mine]), env, f)).json()).deleted).toBe(0)
    expect(b.delete).not.toHaveBeenCalled()
  })
  it('только чужие ключи: сервер ничего не вернул, R2 цел', async () => {
    const b = seed()
    const r = await handleDelete(dreq(['/photos/' + other]), { ...ENV, PHOTOS: b }, seedFetch())
    expect((await r.json()).deleted).toBe(0)
    expect(b.m.has(other)).toBe(true)
  })
  it('более 20 урлов 400; тело больше 16 КБ или без длины 413', async () => {
    expect((await handleDelete(dreq(Array(21).fill(mine)), { ...ENV, PHOTOS: seed() }, mkFetch())).status).toBe(400)
    expect((await handleDelete(dreq([mine], 't', { 'content-length': '20000' }), { ...ENV, PHOTOS: seed() }, mkFetch())).status).toBe(413)
    const r = new Request('https://razborka.net/api/photos/delete', { method: 'POST', body: '{}', headers: { authorization: 'Bearer t' } })
    expect((await handleDelete(r, { ...ENV, PHOTOS: seed() }, mkFetch())).status).toBe(413)
  })
})
