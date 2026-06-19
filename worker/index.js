// Worker для Cloudflare Static Assets.
// Обрабатывает /api/privatbank-rate (прокси курса PrivatBank, обход CORS),
// всё остальное отдаёт статике (SPA) через биндинг ASSETS.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 301 со старого домена tsp.pp.ua (и www) на новый razborka.net, путь+query сохраняем.
    // Netlify-сайт TSP при переезде удалён, поэтому редирект делаем на edge этим воркером.
    if (url.hostname === 'tsp.pp.ua' || url.hostname === 'www.tsp.pp.ua') {
      return Response.redirect(`https://razborka.net${url.pathname}${url.search}`, 301)
    }

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
