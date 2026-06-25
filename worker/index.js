// Cloudflare Worker для razborka.net (Static Assets + edge-SEO).
// Задачи:
//  1. /api/privatbank-rate — прокси курса (обход CORS).
//  2. /sitemap.xml — реальный sitemap из публичных данных Supabase.
//  3. Публичные HTML-маршруты — edge-инъекция per-route мета (title/description/canonical/OG)
//     и JSON-LD, чтобы поиск/соц-краулеры видели уникальные данные без полного SSR.
//  4. Остальное (ассеты, robots.txt) — статика edge напрямую (run_worker_first их не включает).
// Публичные данные берём анонимно (anon-ключ публичен, приватное закрыто RLS).

const SITE = 'https://razborka.net'
const BRAND = 'Razborka.net'
const DEFAULT_OG = SITE + '/pwa-512x512.png'

// ── утилиты ──────────────────────────────────────────────────────────────────
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const escapeXml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

const COND_RU = { new: 'Новая', used: 'Б/У', damaged: 'Под восстановление' }
const COND_SCHEMA = { new: 'NewCondition', used: 'UsedCondition', damaged: 'RefurbishedCondition' }

async function supa(env, path, init = {}) {
  const url = env.SUPABASE_URL + path
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY, ...(init.headers || {}) }
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(2800), cf: { cacheTtl: 120, cacheEverything: true } })
  if (!res.ok) throw new Error('supa ' + res.status)
  return res.json()
}
const rpc = (env, fn, body) => supa(env, '/rest/v1/rpc/' + fn, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
})

// ── сопоставление маршрута ───────────────────────────────────────────────────
function matchRoute(p) {
  p = p.replace(/\/+$/, '') || '/'
  if (p === '/' || p === '/market') return { type: 'home' }
  if (p === '/market/catalog') return { type: 'catalog' }
  if (p === '/market/suppliers') return { type: 'suppliers' }
  let m
  if ((m = p.match(/^\/market\/part\/([^/]+)$/))) return { type: 'product', id: m[1] }
  if ((m = p.match(/^\/public\/parts-item\/([^/]+)$/))) return { type: 'product', id: m[1], dedupePart: true }
  if ((m = p.match(/^\/market\/supplier\/([^/]+)$/))) return { type: 'supplier', id: m[1] }
  if (p === '/business' || p === '/business/apply') return { type: 'business' }
  if (p === '/landing') return { type: 'business' }
  if (p.match(/^\/public\/parts-location\//)) return { type: 'location' }
  // приватное/тонкое — noindex
  if (p === '/market/cart' || p === '/welcome' || p === '/login' || p === '/reset-password' ||
      p === '/vehicle-access' || p.match(/^\/public\/(parts-customer|personal-vehicle)\//)) {
    return { type: 'noindex' }
  }
  return null
}

// ── вычисление мета ──────────────────────────────────────────────────────────
async function computeMeta(route, env, pathname) {
  const canonical = SITE + pathname.replace(/\/+$/, '')
  const base = { canonical, ogImage: DEFAULT_OG, ogType: 'website', robots: null, jsonld: null }

  if (route.type === 'home') return {
    ...base, canonical: SITE + '/',
    title: `${BRAND} — маркет б/у и новых запчастей от авторазборок`,
    description: 'Купить б/у и новые автозапчасти от проверенных авторазборок Украины. Каталог по марке, модели и году, прямой контакт с разборкой.',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE, logo: DEFAULT_OG },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE,
        potentialAction: { '@type': 'SearchAction', target: SITE + '/market/catalog?q={query}', 'query-input': 'required name=query' } },
    ],
  }
  if (route.type === 'catalog') return { ...base, title: `Каталог автозапчастей — ${BRAND}`,
    description: 'Каталог б/у и новых автозапчастей от авторазборок. Фильтр по марке, модели, году и состоянию.' }
  if (route.type === 'suppliers') return { ...base, title: `Авторазборки Украины — ${BRAND}`,
    description: 'Список авторазборок: контакты, города, наличие запчастей. Прямая связь с разборкой.' }
  if (route.type === 'business') return { ...base, title: `Для авторазборок — ${BRAND}`,
    description: 'Подключите авторазборку к Razborka.net: учёт склада, витрина запчастей, заявки покупателей.' }
  if (route.type === 'location') return { ...base, title: `Запчасти на складе — ${BRAND}`,
    description: 'Запчасти в этом месте хранения авторазборки.' }
  if (route.type === 'noindex') return { ...base, robots: 'noindex,follow', title: BRAND,
    description: 'Razborka.net — маркет автозапчастей от авторазборок.' }

  if (route.type === 'product') {
    const it = await rpc(env, 'get_public_parts_item', { p_id: route.id })
    if (!it || !it.name) return { ...base, robots: 'noindex,follow', title: BRAND, description: 'Запчасть не найдена.' }
    const v = it.vehicle || {}
    const veh = [v.make, v.model, v.year].filter(Boolean).join(' ')
    const cur = it.price_currency === 'USD' ? '$' : '₴'
    const price = it.selling_price ? `${Number(it.selling_price).toLocaleString('uk-UA')} ${cur}` : ''
    const cond = COND_RU[it.condition] || ''
    const img = (it.photos && it.photos[0] && (it.photos[0].medium_url || it.photos[0].url)) || it.photo_url || DEFAULT_OG
    const title = clip([it.name, veh].filter(Boolean).join(' — '), 65) + ` | ${BRAND}`
    const description = clip([it.name, cond && `Состояние: ${cond}`, price && `Цена ${price}`, veh && `Авто: ${veh}`, it.part_number && `Номер: ${it.part_number}`].filter(Boolean).join('. ') + '.', 175)
    const canon = SITE + '/market/part/' + route.id // дедуп: /public/parts-item → /market/part
    const offer = it.selling_price ? {
      '@type': 'Offer', price: Number(it.selling_price), priceCurrency: it.price_currency || 'UAH',
      availability: it.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/' + (COND_SCHEMA[it.condition] || 'UsedCondition'), url: canon,
    } : undefined
    return {
      ...base, canonical: canon, ogType: 'product', ogImage: img, title, description,
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Product', name: it.name,
        image: img !== DEFAULT_OG ? img : undefined, sku: it.part_number || undefined,
        description: it.description ? clip(it.description, 300) : description,
        ...(veh ? { brand: { '@type': 'Brand', name: v.make || veh } } : {}),
        ...(offer ? { offers: offer } : {}),
      }],
    }
  }

  if (route.type === 'supplier') {
    let s = null
    try { const list = await rpc(env, 'get_market_suppliers', {}); s = (list || []).find((x) => x.id === route.id) } catch {}
    if (!s) return { ...base, title: `Авторазборка — ${BRAND}`, description: 'Авторазборка на Razborka.net.' }
    const title = clip(`${s.name} — авторазборка${s.city ? ', ' + s.city : ''}`, 65) + ` | ${BRAND}`
    const description = clip([s.name, s.available_parts != null && `${s.available_parts} запчастей в наличии`, s.address].filter(Boolean).join('. ') + '.', 175)
    return {
      ...base, ogType: 'profile', title, description,
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'AutoPartsStore', name: s.name, url: canonical,
        ...(s.phone ? { telephone: s.phone } : {}),
        ...(s.address || s.city ? { address: { '@type': 'PostalAddress', streetAddress: s.address || undefined, addressLocality: s.city || undefined, addressCountry: 'UA' } } : {}),
      }],
    }
  }
  return { ...base, title: BRAND, description: 'Razborka.net — маркет автозапчастей.' }
}

// ── HTMLRewriter-инъекция ────────────────────────────────────────────────────
function injectMeta(res, meta) {
  const head =
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}">` +
    `<meta property="og:type" content="${escapeHtml(meta.ogType)}">` +
    `<meta property="og:site_name" content="${BRAND}">` +
    `<meta property="og:title" content="${escapeHtml(meta.title)}">` +
    `<meta property="og:description" content="${escapeHtml(meta.description)}">` +
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}">` +
    `<meta property="og:image" content="${escapeHtml(meta.ogImage)}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">` +
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">` +
    `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}">` +
    (meta.robots ? `<meta name="robots" content="${escapeHtml(meta.robots)}">` : '') +
    (meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld.length === 1 ? meta.jsonld[0] : meta.jsonld).replace(/</g, '\\u003c')}</script>` : '')

  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(meta.title) } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', meta.description) } })
    .on('head', { element(e) { e.append(head, { html: true }) } })
    .transform(res)
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
async function buildSitemap(env) {
  const urls = ['/', '/market', '/market/catalog', '/market/suppliers', '/business']
  try {
    const parts = await supa(env, '/rest/v1/market_inventory?select=id&limit=50000')
    for (const r of parts || []) urls.push('/market/part/' + r.id)
  } catch {}
  try {
    const sup = await rpc(env, 'get_market_suppliers', {})
    for (const s of sup || []) urls.push('/market/supplier/' + s.id)
  } catch {}
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${escapeXml(SITE + u)}</loc></url>`).join('\n') +
    `\n</urlset>\n`
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}

// ── точка входа ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const p = url.pathname

    // 1. прокси курса
    if (p === '/api/privatbank-rate') {
      try {
        const res = await fetch('https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5', { cf: { cacheTtl: 300, cacheEverything: true } })
        return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } })
      } catch {
        return new Response('[]', { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } })
      }
    }

    // 2. sitemap (с edge-кешем)
    if (p === '/sitemap.xml') {
      const cache = caches.default
      const hit = await cache.match(request)
      if (hit) return hit
      const res = await buildSitemap(env)
      ctx.waitUntil(cache.put(request, res.clone()))
      return res
    }

    // 3. публичные HTML-маршруты → инъекция мета
    const route = matchRoute(p)
    // Любой GET на совпавший публичный маршрут считаем документом: run_worker_first отбирает
    // только публичные HTML-маршруты (ассеты исключены), а не-HTML ответ ниже отсекается по
    // content-type. Не завязываемся на Accept/sec-fetch-dest — иначе краулеры с Accept:*/*
    // (часть соц-ботов, curl) не получат мета.
    if (route && request.method === 'GET') {
      const cache = caches.default
      const cacheKey = new Request(url.origin + p, request)
      const hit = await cache.match(cacheKey)
      if (hit) return hit
      try {
        const assetRes = await env.ASSETS.fetch(request) // SPA-fallback → index.html
        const ct = assetRes.headers.get('content-type') || ''
        if (!ct.includes('text/html')) return assetRes
        let meta
        try { meta = await computeMeta(route, env, p) }
        catch { meta = { title: BRAND, description: 'Razborka.net — маркет автозапчастей от авторазборок.', canonical: SITE + p, ogImage: DEFAULT_OG, ogType: 'website', robots: null, jsonld: null } }
        const out = injectMeta(assetRes, meta)
        const headers = new Headers(out.headers)
        // Тело меняется при инъекции → снять заголовки исходного (возможно сжатого) ответа,
        // иначе клиент попытается распаковать уже-распакованное (битая страница). CF пересожмёт сам.
        headers.delete('content-length')
        headers.delete('content-encoding')
        headers.delete('etag')
        headers.set('cache-control', 'public, max-age=300, must-revalidate')
        const resp = new Response(out.body, { status: 200, headers })
        ctx.waitUntil(cache.put(cacheKey, resp.clone()))
        return resp
      } catch {
        return env.ASSETS.fetch(request) // на любой сбой — обычная статика, сайт не падает
      }
    }

    // 4. статика (последний рубеж — гарантированно что-то отдать)
    try {
      return await env.ASSETS.fetch(request)
    } catch {
      return new Response('', { status: 200 })
    }
  },
}
