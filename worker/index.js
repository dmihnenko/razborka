// Worker для Cloudflare Static Assets.
// Запускается ТОЛЬКО для /api/* (run_worker_first в wrangler.jsonc): обрабатывает
// /api/privatbank-rate (прокси курса PrivatBank, обход CORS); остальное отдаёт статика.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/privatbank-rate') {
      try {
        const upstream = 'https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5'
        const res = await fetch(upstream, { cf: { cacheTtl: 300, cacheEverything: true } })
        const body = await res.text()
        return new Response(body, {
          status: res.status,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            'cache-control': 'public, max-age=300',
          },
        })
      } catch {
        return new Response('[]', {
          status: 502,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      }
    }

    // Статика + SPA-fallback (not_found_handling: single-page-application)
    return env.ASSETS.fetch(request)
  },
}
