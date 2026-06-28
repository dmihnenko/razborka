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
const DEFAULT_OG = SITE + '/og-default.png' // баннер 1200×630 (фолбэк для страниц без фото)

// ── утилиты ──────────────────────────────────────────────────────────────────
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const escapeXml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

// ── LiqPay: base64(UTF-8) и подпись base64(sha1(private + data + private)) ──────
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
function b64decodeUtf8(b64) {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
async function liqpaySign(privateKey, data) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(privateKey + data + privateKey))
  const bytes = new Uint8Array(digest)
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const COND_RU = { new: 'Новая', used: 'Б/У', damaged: 'Под восстановление' }
const COND_SCHEMA = { new: 'NewCondition', used: 'UsedCondition', damaged: 'RefurbishedCondition' }

// JSON-LD хлебные крошки: items = [[name, url], ...]
const breadcrumb = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
})

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

const COND_UK = { new: 'Нова', used: 'Б/в', damaged: 'Під відновлення' }

// ── вычисление мета (lang: 'ru' | 'uk') ───────────────────────────────────────
async function computeMeta(route, env, pathname, lang) {
  const uk = lang === 'uk'
  const q = uk ? '?lng=uk' : ''
  const cleanPath = pathname.replace(/\/+$/, '') || '/'
  // altBase — канонический URL БЕЗ языкового параметра (для hreflang-альтернатив)
  const altBase = route.type === 'product' ? SITE + '/market/part/' + route.id
    : cleanPath === '/' ? SITE + '/'
    : SITE + cleanPath
  const canonical = altBase + q
  const base = { canonical, altBase, lang, ogImage: DEFAULT_OG, ogType: 'website', robots: null, jsonld: null }
  const homeUrl = SITE + '/' + q
  const catUrl = SITE + '/market/catalog' + q
  const bcHome = uk ? 'Головна' : 'Главная'
  const bcCat = 'Каталог'

  if (route.type === 'home') return {
    ...base,
    title: uk ? `${BRAND} — маркет вживаних і нових запчастин від авторозборок`
              : `${BRAND} — маркет б/у и новых запчастей от авторазборок`,
    description: uk
      ? 'Купити вживані та нові автозапчастини від перевірених авторозборок України. Каталог за маркою, моделлю та роком, прямий контакт з розборкою.'
      : 'Купить б/у и новые автозапчасти от проверенных авторазборок Украины. Каталог по марке, модели и году, прямой контакт с разборкой.',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE, logo: DEFAULT_OG },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE,
        potentialAction: { '@type': 'SearchAction', target: SITE + '/market/catalog?q={query}', 'query-input': 'required name=query' } },
    ],
  }
  if (route.type === 'catalog') return { ...base,
    title: uk ? `Каталог автозапчастин — ${BRAND}` : `Каталог автозапчастей — ${BRAND}`,
    description: uk ? 'Каталог вживаних і нових автозапчастин від авторозборок. Фільтр за маркою, моделлю, роком і станом.'
                    : 'Каталог б/у и новых автозапчастей от авторазборок. Фильтр по марке, модели, году и состоянию.',
    jsonld: [breadcrumb([[bcHome, homeUrl], [bcCat, catUrl]])] }
  if (route.type === 'suppliers') return { ...base,
    title: uk ? `Авторозборки України — ${BRAND}` : `Авторазборки Украины — ${BRAND}`,
    description: uk ? 'Список авторозборок: контакти, міста, наявність запчастин. Прямий зв’язок з розборкою.'
                    : 'Список авторазборок: контакты, города, наличие запчастей. Прямая связь с разборкой.' }
  if (route.type === 'business') return { ...base,
    title: uk ? `Для авторозборок — ${BRAND}` : `Для авторазборок — ${BRAND}`,
    description: uk ? 'Підключіть авторозборку до Razborka.net: облік складу, вітрина запчастин, заявки покупців.'
                    : 'Подключите авторазборку к Razborka.net: учёт склада, витрина запчастей, заявки покупателей.' }
  if (route.type === 'location') return { ...base,
    title: uk ? `Запчастини на складі — ${BRAND}` : `Запчасти на складе — ${BRAND}`,
    description: uk ? 'Запчастини в цьому місці зберігання авторозборки.' : 'Запчасти в этом месте хранения авторазборки.' }
  if (route.type === 'noindex') return { ...base, robots: 'noindex,follow', altBase: undefined, title: BRAND,
    description: 'Razborka.net — маркет автозапчастей от авторазборок.' }

  if (route.type === 'product') {
    const it = await rpc(env, 'get_public_parts_item', { p_id: route.id })
    if (!it || !it.name) return { ...base, robots: 'noindex,follow', altBase: undefined, notFound: true,
      title: (uk ? 'Запчастину не знайдено — ' : 'Запчасть не найдена — ') + BRAND,
      description: uk ? 'Запчастину не знайдено або знято з продажу.' : 'Запчасть не найдена или снята с продажи.' }
    const v = it.vehicle || {}
    const veh = [v.make, v.model, v.year].filter(Boolean).join(' ')
    const cur = it.price_currency === 'USD' ? '$' : '₴'
    const price = it.selling_price ? `${Number(it.selling_price).toLocaleString('uk-UA')} ${cur}` : ''
    const cond = (uk ? COND_UK : COND_RU)[it.condition] || ''
    const img = (it.photos && it.photos[0] && (it.photos[0].medium_url || it.photos[0].url)) || it.photo_url || DEFAULT_OG
    const title = clip([it.name, veh].filter(Boolean).join(' — '), 65) + ` | ${BRAND}`
    const L = uk ? { cond: 'Стан', price: 'Ціна', veh: 'Авто', num: 'Номер' } : { cond: 'Состояние', price: 'Цена', veh: 'Авто', num: 'Номер' }
    const description = clip([it.name, cond && `${L.cond}: ${cond}`, price && `${L.price} ${price}`, veh && `${L.veh}: ${veh}`, it.part_number && `${L.num}: ${it.part_number}`].filter(Boolean).join('. ') + '.', 175)
    const canon = altBase + q // дедуп: /public/parts-item → /market/part (+язык)
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
      },
      breadcrumb([[bcHome, homeUrl], [bcCat, catUrl], [clip(it.name, 60), canon]])],
    }
  }

  if (route.type === 'supplier') {
    let s = null
    try { const list = await rpc(env, 'get_market_suppliers', {}); s = (list || []).find((x) => x.id === route.id) } catch {}
    if (!s) return { ...base, robots: 'noindex,follow', altBase: undefined, notFound: true,
      title: (uk ? 'Авторозборку не знайдено — ' : 'Авторазборка не найдена — ') + BRAND,
      description: uk ? 'Авторозборку не знайдено.' : 'Авторазборка не найдена.' }
    const title = clip(`${s.name} — ${uk ? 'авторозборка' : 'авторазборка'}${s.city ? ', ' + s.city : ''}`, 65) + ` | ${BRAND}`
    const partsTxt = s.available_parts != null ? (uk ? `${s.available_parts} запчастин у наявності` : `${s.available_parts} запчастей в наличии`) : null
    const description = clip([s.name, partsTxt, s.address].filter(Boolean).join('. ') + '.', 175)
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
  const uk = meta.lang === 'uk'
  // hreflang-альтернативы (только для индексируемых страниц: есть altBase)
  const alts = meta.altBase
    ? `<link rel="alternate" hreflang="ru" href="${escapeHtml(meta.altBase)}">` +
      `<link rel="alternate" hreflang="uk" href="${escapeHtml(meta.altBase + '?lng=uk')}">` +
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(meta.altBase)}">`
    : ''
  const head =
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}">` +
    alts +
    `<meta property="og:type" content="${escapeHtml(meta.ogType)}">` +
    `<meta property="og:site_name" content="${BRAND}">` +
    `<meta property="og:title" content="${escapeHtml(meta.title)}">` +
    `<meta property="og:description" content="${escapeHtml(meta.description)}">` +
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}">` +
    `<meta property="og:image" content="${escapeHtml(meta.ogImage)}">` +
    `<meta property="og:locale" content="${uk ? 'uk_UA' : 'ru_RU'}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">` +
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">` +
    `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}">` +
    (meta.robots ? `<meta name="robots" content="${escapeHtml(meta.robots)}">` : '') +
    (meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld.length === 1 ? meta.jsonld[0] : meta.jsonld).replace(/</g, '\\u003c')}</script>` : '')

  return new HTMLRewriter()
    .on('html', { element(e) { e.setAttribute('lang', uk ? 'uk' : 'ru') } })
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

// ── крон: обновление глобального курса USD (анти-спам: только крон бьёт ПриватБанк) ──
async function updateGlobalRate(env) {
  try {
    const res = await fetch('https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5')
    const list = await res.json()
    const usd = (list || []).find((i) => i.ccy === 'USD' && i.base_ccy === 'UAH')
    const rate = parseFloat(usd?.sale)
    if (!rate || isNaN(rate) || rate <= 0) return
    await fetch(env.SUPABASE_URL + '/rest/v1/rpc/set_global_usd_rate', {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rate: rate, p_source: 'privatbank', p_secret: env.CRON_RATE_SECRET }),
    })
  } catch { /* best-effort: следующий запуск крона повторит */ }
}

// ── крон: авто-синк статусов Новой Почты (ключ NP у каждой разборки свой) ──────
async function syncNpShipments(env) {
  const rpc = (fn, body) => fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  try {
    const rows = await rpc('get_shipments_to_sync', { p_secret: env.CRON_RATE_SECRET })
      .then((r) => r.json()).catch(() => null)
    if (!Array.isArray(rows) || !rows.length) return

    // группируем по ключу NP (= по компании) и бьём НП ключом каждой компании
    const byKey = new Map()
    for (const r of rows) {
      if (!byKey.has(r.api_key)) byKey.set(r.api_key, [])
      byKey.get(r.api_key).push(r)
    }
    const updates = []
    for (const [apiKey, list] of byKey) {
      // НП getStatusDocuments принимает до 100 документов за вызов
      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100)
        try {
          const resp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey, modelName: 'TrackingDocument', calledMethod: 'getStatusDocuments',
              methodProperties: { Documents: chunk.map((r) => ({ DocumentNumber: r.ttn, Phone: '' })) },
            }),
            signal: AbortSignal.timeout(8000),
          }).then((r) => r.json())
          if (!resp || !resp.success) continue
          const byTtn = new Map((resp.data || []).map((d) => [String(d.Number), d]))
          for (const r of chunk) {
            const d = byTtn.get(String(r.ttn))
            if (d && d.StatusCode) updates.push({ id: r.id, status: d.Status || '', status_code: String(d.StatusCode) })
          }
        } catch { /* пропускаем чанк, повторим в след. запуск */ }
      }
    }
    if (updates.length) await rpc('apply_shipment_statuses', { p_secret: env.CRON_RATE_SECRET, p_updates: updates })
  } catch { /* best-effort */ }
}

// ── точка входа ──────────────────────────────────────────────────────────────
export default {
  // Крон: курс USD (06:30/12:30 UTC) + синк Новой Почты (каждые 30 мин)
  async scheduled(event, env, ctx) {
    if (event.cron === '*/30 * * * *') ctx.waitUntil(syncNpShipments(env))
    else ctx.waitUntil(updateGlobalRate(env))
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const p = url.pathname

    // 0. www → apex (канонический хост, без дублей в индексе)
    if (url.hostname === 'www.razborka.net') {
      return Response.redirect(SITE + p + url.search, 301)
    }

    // 1. прокси курса
    if (p === '/api/privatbank-rate') {
      try {
        const res = await fetch('https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5', { cf: { cacheTtl: 300, cacheEverything: true } })
        return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } })
      } catch {
        return new Response('[]', { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } })
      }
    }

    // 1b. LiqPay: подпись checkout (приватный ключ только на сервере).
    if (p === '/api/liqpay-checkout' && request.method === 'POST') {
      try {
        if (!env.LIQPAY_PUBLIC_KEY || !env.LIQPAY_PRIVATE_KEY) return json({ error: 'liqpay_not_configured' }, 503)
        const auth = request.headers.get('authorization') || ''
        const body = await request.json().catch(() => ({}))
        const orderId = body.order_id
        if (!orderId || !auth.startsWith('Bearer ')) return json({ error: 'bad_request' }, 400)
        // pending-платёж читаем ПОД ТОКЕНОМ пользователя (RLS отдаёт только свой) — сумма из БД, не от клиента
        const rows = await fetch(
          env.SUPABASE_URL + '/rest/v1/subscription_payments?order_id=eq.' + encodeURIComponent(orderId) +
          '&status=eq.pending&select=order_id,amount,description',
          { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth } },
        ).then((r) => r.json()).catch(() => null)
        const row = rows && rows[0]
        if (!row) return json({ error: 'not_found' }, 404)
        const params = {
          public_key: env.LIQPAY_PUBLIC_KEY, version: '3', action: 'pay',
          amount: Number(row.amount), currency: 'UAH',
          description: row.description || 'Подписка Razborka.net',
          order_id: row.order_id,
          server_url: SITE + '/api/liqpay-callback',
          result_url: SITE + '/parts/subscription?paid=' + encodeURIComponent(row.order_id),
          language: 'uk',
        }
        const data = b64encodeUtf8(JSON.stringify(params))
        const signature = await liqpaySign(env.LIQPAY_PRIVATE_KEY, data)
        return json({ data, signature, url: 'https://www.liqpay.ua/api/3/checkout' })
      } catch { return json({ error: 'server_error' }, 500) }
    }

    // 1c. LiqPay: серверный callback — ЕДИНСТВЕННЫЙ источник активации подписки.
    // Проверяем HMAC-подпись приватным ключом (доверяем серверу LiqPay, а не клиенту).
    if (p === '/api/liqpay-callback' && request.method === 'POST') {
      try {
        if (!env.LIQPAY_PRIVATE_KEY) return new Response('not configured', { status: 503 })
        const form = await request.formData()
        const data = form.get('data'); const signature = form.get('signature')
        if (!data || !signature) return new Response('bad request', { status: 400 })
        const expected = await liqpaySign(env.LIQPAY_PRIVATE_KEY, data)
        if (expected !== signature) return new Response('bad signature', { status: 400 })
        const payload = JSON.parse(b64decodeUtf8(data))
        // Применяем в БД: RPC идемпотентен, сверяет сумму и защищён внутренним секретом.
        await fetch(env.SUPABASE_URL + '/rest/v1/rpc/liqpay_apply_callback', {
          method: 'POST',
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_order_id: payload.order_id, p_status: payload.status,
            p_liqpay_id: String(payload.payment_id || payload.transaction_id || ''),
            p_amount: payload.amount, p_secret: env.LIQPAY_CALLBACK_SECRET,
          }),
        })
        return new Response('ok', { status: 200 })  // LiqPay ждёт 200; при сбое у них ретраи
      } catch { return new Response('ok', { status: 200 }) }
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
      const lang = url.searchParams.get('lng') === 'uk' ? 'uk' : 'ru'
      const cache = caches.default
      // язык в ключе кеша — иначе ru/uk ответы перепутаются
      const cacheKey = new Request(url.origin + p + (lang === 'uk' ? '?lng=uk' : ''), request)
      const hit = await cache.match(cacheKey)
      if (hit) return hit
      try {
        const assetRes = await env.ASSETS.fetch(request) // SPA-fallback → index.html
        const ct = assetRes.headers.get('content-type') || ''
        if (!ct.includes('text/html')) return assetRes
        let meta
        try { meta = await computeMeta(route, env, p, lang) }
        catch { meta = { title: BRAND, description: 'Razborka.net — маркет автозапчастей от авторазборок.', canonical: SITE + p, altBase: undefined, lang, ogImage: DEFAULT_OG, ogType: 'website', robots: null, jsonld: null } }
        const out = injectMeta(assetRes, meta)
        const headers = new Headers(out.headers)
        // Тело меняется при инъекции → снять заголовки исходного (возможно сжатого) ответа,
        // иначе клиент попытается распаковать уже-распакованное (битая страница). CF пересожмёт сам.
        headers.delete('content-length')
        headers.delete('content-encoding')
        headers.delete('etag')
        headers.set('cache-control', 'public, max-age=300, must-revalidate')
        // Несуществующая сущность → честный 404 (а не soft-404 200+noindex), не кешируем
        const resp = new Response(out.body, { status: meta.notFound ? 404 : 200, headers })
        if (!meta.notFound) ctx.waitUntil(cache.put(cacheKey, resp.clone()))
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
