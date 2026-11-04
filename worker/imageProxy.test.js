import { describe, it, expect, vi } from 'vitest'
import { handleImageProxy } from './imageProxy.js'

const req = (path, method = 'GET') => new Request('https://razborka.net' + path, { method })
const img = (status = 200, type = 'image/jpeg') =>
  vi.fn(async () => new Response('x', { status, headers: { 'content-type': type } }))

describe('handleImageProxy', () => {
  it('200 image проходит с долгим кэшем', async () => {
    const f = img()
    const r = await handleImageProxy(req('/img/ibb/abc/photo.jpg'), f)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/jpeg')
    expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('set-cookie')).toBeNull()
    expect(f.mock.calls[0][0]).toBe('https://i.ibb.co/abc/photo.jpg')
    expect(f.mock.calls[0][1].cf.cacheEverything).toBe(true)
  })
  it('503 с картинкой -> 404 no-store', async () => {
    const r = await handleImageProxy(req('/img/ibb/a/b.png'), img(503, 'image/png'))
    expect(r.status).toBe(404)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.text()).toBe('')
  })
  it('200 html -> 404', async () => {
    const r = await handleImageProxy(req('/img/ibb/a/b.png'), img(200, 'text/html'))
    expect(r.status).toBe(404)
  })
  it('таймаут -> 504', async () => {
    const f = vi.fn(async () => { throw new DOMException('t', 'TimeoutError') })
    const r = await handleImageProxy(req('/img/ibb/a/b.png'), f)
    expect(r.status).toBe(504)
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
  it('плохие пути -> 404 без запроса', async () => {
    const f = img()
    for (const p of ['/img/ibb/../etc', '/img/ibb/a?x=1', '/img/ibb/', '/img/ibb/a%2fb', '/img/ibb/a/%5c', '/img/ibb/a$b', '/img/ibb/a//b', '/img/ibb/https://evil.com/x']) {
      expect((await handleImageProxy(req(p), f)).status).toBe(404)
    }
    expect(f).not.toHaveBeenCalled()
  })
  it('чужой хост невозможен: всегда i.ibb.co', async () => {
    const f = img()
    await handleImageProxy(req('/img/ibb/evil.com/x.jpg'), f)
    expect(new URL(f.mock.calls[0][0]).host).toBe('i.ibb.co')
  })
  it('HEAD без тела', async () => {
    const r = await handleImageProxy(req('/img/ibb/a/b.jpg', 'HEAD'), img())
    expect(r.status).toBe(200)
  })
})
