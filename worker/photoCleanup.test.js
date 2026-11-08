import { describe, it, expect, vi } from 'vitest'
import { cleanupPhotos, MAX_LIST_PAGES } from './photoCleanup.js'

const ENV0 = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', PHOTO_WORKER_SECRET: 'sec' }
const NOW = Date.parse('2026-11-09T00:00:00Z')
const OLD = new Date(NOW - 5 * 24 * 3600 * 1000).toISOString()
const FRESH = new Date(NOW - 3600 * 1000).toISOString()

function fakeBucket(objects, pageSize = 1000) {
  const m = new Map(objects.map((o) => [o.key, o]))
  return {
    m,
    delete: vi.fn(async (k) => { for (const x of [].concat(k)) m.delete(x) }),
    list: vi.fn(async ({ cursor }) => {
      const all = [...m.values()]
      const start = cursor ? Number(cursor) : 0
      const objs = all.slice(start, start + pageSize)
      const end = start + pageSize
      return { objects: objs, truncated: end < all.length, cursor: String(end) }
    }),
  }
}
function mkFetch({ orphans = [], known = [] } = {}) {
  let first = true
  return vi.fn(async (url, init) => {
    const body = JSON.parse(init.body)
    if (url.endsWith('/photo_orphans')) {
      const r = first ? orphans.map((key) => ({ key, parts_company_id: 'c', size_bytes: 1 })) : []
      first = false
      return new Response(JSON.stringify(r))
    }
    if (url.endsWith('/photo_purge')) return new Response(String(body.p_keys.length))
    if (url.endsWith('/photo_known_keys')) return new Response(JSON.stringify(body.p_keys.filter((k) => known.includes(k))))
    if (url.endsWith('/photo_recompute_usage')) return new Response('3')
    return new Response('null')
  })
}
const calls = (f, n) => f.mock.calls.filter((c) => c[0].endsWith('/' + n))

describe('cleanupPhotos', () => {
  it('выходит без секрета или бакета', async () => {
    const f = mkFetch()
    expect(await cleanupPhotos({ ...ENV0, PHOTOS: fakeBucket([]), PHOTO_WORKER_SECRET: '' }, f, NOW)).toBeNull()
    expect(await cleanupPhotos({ ...ENV0 }, f, NOW)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('удаляет сирот и purge только по реально удалённым', async () => {
    const bucket = fakeBucket([{ key: 'c/a/b/full.jpg', uploaded: OLD }, { key: 'c/a/b/thumb.jpg', uploaded: OLD }])
    bucket.delete.mockImplementationOnce(async () => { throw new Error('r2 down') })
    const f = mkFetch({ orphans: ['c/a/b/full.jpg'], known: ['c/a/b/full.jpg', 'c/a/b/thumb.jpg'] })
    const st = await cleanupPhotos({ ...ENV0, PHOTOS: bucket }, f, NOW)
    expect(st.purged).toBe(0)
    expect(calls(f, 'photo_purge')).toHaveLength(0)

    const bucket2 = fakeBucket([{ key: 'c/a/b/full.jpg', uploaded: OLD }])
    const f2 = mkFetch({ orphans: ['c/a/b/full.jpg'], known: [] })
    const st2 = await cleanupPhotos({ ...ENV0, PHOTOS: bucket2 }, f2, NOW)
    expect(JSON.parse(calls(f2, 'photo_purge')[0][1].body)).toMatchObject({ p_keys: ['c/a/b/full.jpg'], p_secret: 'sec' })
    expect(st2.purged).toBe(1)
    expect(calls(f2, 'photo_recompute_usage')).toHaveLength(1)
  })

  it('неизвестные базе старше 3 дней удаляются, свежие и известные нет', async () => {
    const bucket = fakeBucket([
      { key: 'c/a/1/full.jpg', uploaded: OLD }, // неизвестный старый
      { key: 'c/a/2/full.jpg', uploaded: FRESH }, // свежий
      { key: 'c/a/3/full.jpg', uploaded: OLD }, // известный
    ])
    const f = mkFetch({ known: ['c/a/3/full.jpg'] })
    const st = await cleanupPhotos({ ...ENV0, PHOTOS: bucket }, f, NOW)
    expect(st.strays).toBe(1)
    expect([...bucket.m.keys()].sort()).toEqual(['c/a/2/full.jpg', 'c/a/3/full.jpg'])
  })

  it('ограничивает число страниц листинга', async () => {
    const objs = Array.from({ length: 20 }, (_, i) => ({ key: `c/a/${i}/full.jpg`, uploaded: FRESH }))
    const bucket = fakeBucket(objs, 2)
    await cleanupPhotos({ ...ENV0, PHOTOS: bucket }, mkFetch(), NOW)
    expect(bucket.list).toHaveBeenCalledTimes(MAX_LIST_PAGES)
  })

  it('ошибка RPC не роняет уборку', async () => {
    const f = vi.fn(async () => new Response('x', { status: 500 }))
    const st = await cleanupPhotos({ ...ENV0, PHOTOS: fakeBucket([]) }, f, NOW)
    expect(st).toMatchObject({ purged: 0, strays: 0, recomputed: 0 })
  })
})
