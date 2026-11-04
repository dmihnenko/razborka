// Прокси картинок imgbb: i.ibb.co при сбоях отдаёт 503 с картинкой-заглушкой.
// Пропускаем только 200 + image/*, остальное -> 404/504 (браузер вызовет onError).
const ORIGIN = 'https://i.ibb.co/'
const PREFIX = '/img/ibb/'
const SEG_RE = /^[A-Za-z0-9._%-]+$/
const TIMEOUT_MS = 8000

const fail = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

export function isImageProxyPath(pathname) {
  return pathname.startsWith(PREFIX)
}

export async function handleImageProxy(request, fetchFn = fetch) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405)
  const url = new URL(request.url)
  if (url.search) return fail(404)
  if (!url.pathname.startsWith(PREFIX)) return fail(404)
  const segs = url.pathname.slice(PREFIX.length).split('/')
  if (!segs.length || segs.some((s) => !SEG_RE.test(s) || s === '.' || s === '..' || s.includes('..') || /%2e|%2f|%5c/i.test(s))) {
    return fail(404)
  }
  let res
  try {
    res = await fetchFn(ORIGIN + segs.join('/'), {
      method: request.method,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 31536000, '300-599': 0 } },
    })
  } catch (e) {
    return fail(e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 504 : 404)
  }
  const type = res.headers.get('content-type') || ''
  if (res.status !== 200 || !/^image\//i.test(type)) return fail(404)
  return new Response(request.method === 'HEAD' ? null : res.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
