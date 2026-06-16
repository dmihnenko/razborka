// Cloudflare Pages Function: прокси курса PrivatBank (обход CORS).
// Маршрут /api/privatbank-rate — аналог редиректа из netlify.toml.
export async function onRequest() {
  const upstream = 'https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5'
  try {
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
