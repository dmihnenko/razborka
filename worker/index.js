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

// slug для SEO-URL марки/модели (детерминированный — одинаков в воркере, sitemap и клиенте)
const slugify = (s) => String(s ?? '').toLowerCase().trim()
  .replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-+|-+$/g, '')

// ── серверный SEO-body (контент в сыром HTML для краулеров без JS) ──────────────
// Инжектится в <div id="root">…</div>; React при гидратации заменит его (createRoot
// очищает контейнер) — пользователи видят обычное приложение, краулер без JS видит контент.
const A = (href, text) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
const seoBody = (h1, parts) => `<main><h1>${escapeHtml(h1)}</h1>${parts.filter(Boolean).join('')}</main>`

// каталог авто (марки/модели с доступными товарами) — для перелинковки и landing.
// Кеш — на уровне supa() (cf cacheTtl 120с), без module-level кеша (избегаем staleness
// на всё время жизни изолята Cloudflare).
async function getCarCatalog(env) {
  try {
    const data = await rpc(env, 'get_market_car_catalog', {})
    return Array.isArray(data) ? data : []
  } catch { return [] }
}
// HTML-блок ссылок на марки (только с count>0), для главной/каталога
function makesLinksHtml(catalog, uk) {
  const makes = (catalog || []).filter((m) => (m.count || 0) > 0)
  if (!makes.length) return ''
  const label = uk ? 'Запчастини за маркою' : 'Запчасти по марке'
  const links = makes.map((m) => A(SITE + '/market/catalog/' + slugify(m.make), m.make)).join(' · ')
  return `<nav aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2>${links}</nav>`
}

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
  // SEO-лендинги по марке/модели: /market/catalog/tesla[/model-3]
  if ((m = p.match(/^\/market\/catalog\/([^/]+)\/([^/]+)$/))) return { type: 'brand', makeSlug: m[1], modelSlug: m[2] }
  if ((m = p.match(/^\/market\/catalog\/([^/]+)$/))) return { type: 'brand', makeSlug: m[1] }
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

  if (route.type === 'home') {
    const catalog = await getCarCatalog(env)
    const h1 = uk ? 'Маркет автозапчастин від авторозборок України' : 'Маркет автозапчастей от авторазборок Украины'
    const intro = uk
      ? 'Купуйте вживані та нові автозапчастини напряму від перевірених авторозборок. Каталог за маркою, моделлю та роком, прямий контакт з розборкою, доставка Новою Поштою.'
      : 'Покупайте б/у и новые автозапчасти напрямую от проверенных авторазборок. Каталог по марке, модели и году, прямой контакт с разборкой, доставка Новой Почтой.'
    const homeNav = `<nav>${A(catUrl, bcCat)} · ${A(SITE + '/market/suppliers' + q, uk ? 'Авторозборки' : 'Авторазборки')} · ${A(SITE + '/business' + q, uk ? 'Для авторозборок' : 'Для авторазборок')}</nav>`
    return {
    ...base,
    body: seoBody(h1, [`<p>${escapeHtml(intro)}</p>`, homeNav, makesLinksHtml(catalog, uk)]),
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
  }
  if (route.type === 'catalog') {
    const catalog = await getCarCatalog(env)
    return { ...base,
    body: seoBody(uk ? 'Каталог автозапчастин' : 'Каталог автозапчастей', [`<p>${escapeHtml(uk ? 'Б/в та нові автозапчастини від авторозборок. Оберіть марку, модель, рік і стан.' : 'Б/у и новые автозапчасти от авторазборок. Выберите марку, модель, год и состояние.')}</p>`, makesLinksHtml(catalog, uk)]),
    title: uk ? `Каталог автозапчастин — ${BRAND}` : `Каталог автозапчастей — ${BRAND}`,
    description: uk ? 'Каталог вживаних і нових автозапчастин від авторозборок. Фільтр за маркою, моделлю, роком і станом.'
                    : 'Каталог б/у и новых автозапчастей от авторазборок. Фильтр по марке, модели, году и состоянию.',
    jsonld: [breadcrumb([[bcHome, homeUrl], [bcCat, catUrl]])] }
  }
  if (route.type === 'suppliers') return { ...base,
    body: seoBody(uk ? 'Авторозборки України' : 'Авторазборки Украины', [`<p>${escapeHtml(uk ? 'Перелік авторозборок: контакти, міста, наявність запчастин. Прямий контакт з розборкою.' : 'Список авторазборок: контакты, города, наличие запчастей. Прямой контакт с разборкой.')}</p>`, `<nav>${A(catUrl, uk ? 'Каталог запчастин' : 'Каталог запчастей')}</nav>`]),
    title: uk ? `Авторозборки України — ${BRAND}` : `Авторазборки Украины — ${BRAND}`,
    description: uk ? 'Список авторозборок: контакти, міста, наявність запчастин. Прямий зв’язок з розборкою.'
                    : 'Список авторазборок: контакты, города, наличие запчастей. Прямая связь с разборкой.' }
  if (route.type === 'business') return { ...base,
    body: seoBody(uk ? 'Razborka.net для авторозборок' : 'Razborka.net для авторазборок', [`<p>${escapeHtml(uk ? 'Облік складу, вітрина запчастин у маркеті, заявки покупців, інтеграція з Новою Поштою та Telegram.' : 'Учёт склада, витрина запчастей в маркете, заявки покупателей, интеграция с Новой Почтой и Telegram.')}</p>`, `<p>${A(SITE + '/business/apply' + q, uk ? 'Підключити авторозборку' : 'Подключить авторозборку')}</p>`]),
    title: uk ? `Для авторозборок — ${BRAND}` : `Для авторазборок — ${BRAND}`,
    description: uk ? 'Підключіть авторозборку до Razborka.net: облік складу, вітрина запчастин, заявки покупців.'
                    : 'Подключите авторазборку к Razborka.net: учёт склада, витрина запчастей, заявки покупателей.' }
  if (route.type === 'location') return { ...base,
    title: uk ? `Запчастини на складі — ${BRAND}` : `Запчасти на складе — ${BRAND}`,
    description: uk ? 'Запчастини в цьому місці зберігання авторозборки.' : 'Запчасти в этом месте хранения авторазборки.' }
  if (route.type === 'brand') {
    const catalog = await getCarCatalog(env)
    const makeEntry = (catalog || []).find((m) => slugify(m.make) === route.makeSlug && (m.count || 0) > 0)
    if (!makeEntry) return { ...base, robots: 'noindex,follow', altBase: undefined, notFound: true,
      title: (uk ? 'Нічого не знайдено — ' : 'Ничего не найдено — ') + BRAND,
      description: uk ? 'За цією маркою поки немає запчастин.' : 'По этой марке пока нет запчастей.' }
    const make = makeEntry.make
    const modelEntry = route.modelSlug
      ? (makeEntry.models || []).find((mm) => slugify(mm.model) === route.modelSlug && (mm.count || 0) > 0)
      : null
    if (route.modelSlug && !modelEntry) return { ...base, robots: 'noindex,follow', altBase: undefined, notFound: true,
      title: (uk ? 'Нічого не знайдено — ' : 'Ничего не найдено — ') + BRAND,
      description: uk ? 'За цією моделлю поки немає запчастин.' : 'По этой модели пока нет запчастей.' }
    const model = modelEntry ? modelEntry.model : null
    const label = [make, model].filter(Boolean).join(' ')
    const cnt = modelEntry ? modelEntry.count : makeEntry.count
    const h1 = uk ? `Запчастини ${label}` : `Запчасти ${label}`
    const cntTxt = uk ? `${cnt} запчастин у наявності` : `${cnt} запчастей в наличии`
    let links = ''
    if (!model) {
      const models = (makeEntry.models || []).filter((mm) => (mm.count || 0) > 0)
      links = models.length ? `<nav><h2>${escapeHtml(uk ? 'Моделі' : 'Модели')}</h2>` +
        models.map((mm) => A(SITE + '/market/catalog/' + route.makeSlug + '/' + slugify(mm.model), `${make} ${mm.model}`)).join(' · ') + '</nav>' : ''
    } else {
      links = `<nav>${A(SITE + '/market/catalog/' + route.makeSlug, uk ? `Усі запчастини ${make}` : `Все запчасти ${make}`)}</nav>`
    }
    const bc = [[bcHome, homeUrl], [bcCat, catUrl], [make, SITE + '/market/catalog/' + route.makeSlug + q]]
    if (model) bc.push([label, SITE + '/market/catalog/' + route.makeSlug + '/' + route.modelSlug + q])
    return { ...base,
      title: `${h1} — ${BRAND}`,
      description: uk ? `Купити запчастини ${label} від авторозборок: ${cntTxt}. Б/в та нові, доставка Новою Поштою.`
                      : `Купить запчасти ${label} от авторазборок: ${cntTxt}. Б/у и новые, доставка Новой Почтой.`,
      body: seoBody(h1, [`<p>${escapeHtml((uk ? `Запчастини ${label} від перевірених авторозборок. ` : `Запчасти ${label} от проверенных авторазборок. `) + cntTxt + '.')}</p>`, links]),
      jsonld: [breadcrumb(bc)] }
  }
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
    const co = it.company || null
    const seller = co ? { '@type': 'AutoPartsStore', name: co.name } : undefined
    const priceValidUntil = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    const offer = it.selling_price ? {
      '@type': 'Offer', price: Number(it.selling_price), priceCurrency: it.price_currency || 'UAH',
      availability: it.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/' + (COND_SCHEMA[it.condition] || 'UsedCondition'), url: canon,
      priceValidUntil,
      ...(seller ? { seller } : {}),
      ...(co && co.warranty_enabled && co.warranty_days ? { warranty: { '@type': 'WarrantyPromise',
        durationOfWarranty: { '@type': 'QuantitativeValue', value: co.warranty_days, unitCode: 'DAY' } } } : {}),
      shippingDetails: { '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'UA' },
        deliveryTime: { '@type': 'ShippingDeliveryTime', transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' } } },
    } : undefined
    const rating = it.rating && it.rating.count > 0
      ? { '@type': 'AggregateRating', ratingValue: it.rating.avg, reviewCount: it.rating.count } : undefined
    // SEO-body товара (контент в сыром HTML)
    const facts = [cond && `${L.cond}: ${cond}`, price && `${L.price}: ${price}`, veh && `${L.veh}: ${veh}`, it.part_number && `${L.num}: ${it.part_number}`].filter(Boolean)
    const sellerLink = co ? `<p>${escapeHtml(uk ? 'Продавець' : 'Продавец')}: ${A(SITE + '/market/supplier/' + co.id + q, co.name)}</p>` : ''
    const brandLink = veh && v.make ? `<p>${A(SITE + '/market/catalog/' + slugify(v.make) + (v.model ? '/' + slugify(v.model) : '') + q, (uk ? 'Усі запчастини ' : 'Все запчасти ') + [v.make, v.model].filter(Boolean).join(' '))}</p>` : ''
    const body = seoBody(it.name, [
      img !== DEFAULT_OG ? `<img src="${escapeHtml(img)}" alt="${escapeHtml([it.name, veh].filter(Boolean).join(' '))}" width="600" height="450" loading="lazy">` : '',
      facts.length ? `<ul>${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : '',
      it.description ? `<p>${escapeHtml(clip(it.description, 600))}</p>` : '',
      sellerLink, brandLink,
    ])
    const pbc = [[bcHome, homeUrl], [bcCat, catUrl]]
    if (veh && v.make) {
      pbc.push([v.make, SITE + '/market/catalog/' + slugify(v.make) + q])
      if (v.model) pbc.push([[v.make, v.model].join(' '), SITE + '/market/catalog/' + slugify(v.make) + '/' + slugify(v.model) + q])
    }
    pbc.push([clip(it.name, 60), canon])
    return {
      ...base, canonical: canon, ogType: 'product', ogImage: img, title, description, body,
      jsonld: [{
        '@context': 'https://schema.org', '@type': 'Product', name: it.name,
        image: img !== DEFAULT_OG ? img : undefined, sku: it.part_number || undefined,
        description: it.description ? clip(it.description, 300) : description,
        ...(veh ? { brand: { '@type': 'Brand', name: v.make || veh } } : {}),
        ...(rating ? { aggregateRating: rating } : {}),
        ...(offer ? { offers: offer } : {}),
      },
      breadcrumb(pbc)],
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
    const sFacts = [s.city && `${uk ? 'Місто' : 'Город'}: ${s.city}`, s.address, partsTxt, s.phone && `${uk ? 'Телефон' : 'Телефон'}: ${s.phone}`].filter(Boolean)
    const body = seoBody(s.name, [
      `<p>${escapeHtml((uk ? 'Авторозборка' : 'Авторазборка') + (s.city ? ', ' + s.city : '') + '.')}</p>`,
      sFacts.length ? `<ul>${sFacts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : '',
      `<nav>${A(catUrl, uk ? 'Каталог запчастин' : 'Каталог запчастей')} · ${A(SITE + '/market/suppliers' + q, uk ? 'Усі авторозборки' : 'Все авторазборки')}</nav>`,
    ])
    return {
      ...base, ogType: 'profile', title, description, body,
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

  const rewriter = new HTMLRewriter()
    .on('html', { element(e) { e.setAttribute('lang', uk ? 'uk' : 'ru') } })
    .on('title', { element(e) { e.setInnerContent(meta.title) } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', meta.description) } })
    .on('head', { element(e) { e.append(head, { html: true }) } })
  // Серверный SEO-body внутрь #root: краулер без JS видит контент; React при гидратации
  // (createRoot) очищает контейнер и рендерит приложение — пользователь не замечает.
  if (meta.body) {
    rewriter.on('#root', { element(e) { e.setInnerContent(meta.body, { html: true }) } })
  }
  return rewriter.transform(res)
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
// <url> с hreflang-альтернативами (ru/uk/x-default), lastmod и image:image.
function sitemapUrl(path, opts = {}) {
  const loc = SITE + path
  const alts =
    `<xhtml:link rel="alternate" hreflang="ru" href="${escapeXml(loc)}"/>` +
    `<xhtml:link rel="alternate" hreflang="uk" href="${escapeXml(loc + '?lng=uk')}"/>` +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`
  const lastmod = opts.lastmod ? `<lastmod>${escapeXml(opts.lastmod)}</lastmod>` : ''
  const image = opts.image ? `<image:image><image:loc>${escapeXml(opts.image)}</image:loc></image:image>` : ''
  return `  <url><loc>${escapeXml(loc)}</loc>${alts}${lastmod}${image}</url>`
}

async function buildSitemap(env) {
  const entries = ['/', '/market', '/market/catalog', '/market/suppliers', '/business'].map((p) => sitemapUrl(p))

  // товары: lastmod из created_at + image из фото
  try {
    const parts = await supa(env, '/rest/v1/market_inventory?select=id,created_at,photos,photo_url&limit=50000')
    for (const r of parts || []) {
      const img = (r.photos && r.photos[0] && (r.photos[0].medium_url || r.photos[0].url)) || r.photo_url || null
      entries.push(sitemapUrl('/market/part/' + r.id, { lastmod: r.created_at || undefined, image: img || undefined }))
    }
  } catch {}

  // авторазборки
  try {
    const sup = await rpc(env, 'get_market_suppliers', {})
    for (const s of sup || []) entries.push(sitemapUrl('/market/supplier/' + s.id))
  } catch {}

  // SEO-лендинги: марка и марка/модель (только с доступными товарами)
  try {
    const catalog = await getCarCatalog(env)
    for (const m of catalog || []) {
      if ((m.count || 0) <= 0) continue
      const ms = slugify(m.make)
      entries.push(sitemapUrl('/market/catalog/' + ms))
      for (const mm of m.models || []) {
        if ((mm.count || 0) > 0) entries.push(sitemapUrl('/market/catalog/' + ms + '/' + slugify(mm.model)))
      }
    }
  } catch {}

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.join('\n') +
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

    // 0c. IndexNow: мгновенный пинг новых/изменённых URL (вызывается Supabase-вебхуком).
    //     Файл-ключ /<key>.txt кладётся в public/ как статика при активации.
    //     Защита: внутренний секрет (как у крон-RPC). Тело: { urls: ["/market/part/.."] }.
    if (p === '/api/indexnow' && request.method === 'POST') {
      try {
        if (!env.INDEXNOW_KEY) return json({ error: 'indexnow_not_configured' }, 503)
        const body = await request.json().catch(() => ({}))
        if (body.secret !== env.CRON_RATE_SECRET) return json({ error: 'forbidden' }, 403)
        const list = Array.isArray(body.urls) ? body.urls.slice(0, 1000) : []
        const urlList = list.map((u) => (String(u).startsWith('http') ? u : SITE + u))
        if (!urlList.length) return json({ ok: true, count: 0 })
        const res = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: 'razborka.net', key: env.INDEXNOW_KEY,
            keyLocation: SITE + '/' + env.INDEXNOW_KEY + '.txt', urlList }),
        })
        return json({ ok: res.ok, status: res.status, count: urlList.length })
      } catch { return json({ error: 'server_error' }, 500) }
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
        const applyRes = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/liqpay_apply_callback', {
          method: 'POST',
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_order_id: payload.order_id, p_status: payload.status,
            p_liqpay_id: String(payload.payment_id || payload.transaction_id || ''),
            p_amount: payload.amount, p_secret: env.LIQPAY_CALLBACK_SECRET,
          }),
        })
        // КРИТИЧНО: не глотать сбой применения. RPC идемпотентен → отвечаем 500,
        // чтобы LiqPay ретраил (иначе оплата спишется, а подписка не активируется).
        if (!applyRes.ok) {
          const detail = await applyRes.text().catch(() => '')
          console.error('liqpay_apply_callback failed', applyRes.status, detail)
          return new Response('retry', { status: 500 })
        }
        return new Response('ok', { status: 200 })  // LiqPay ждёт 200 при успехе
      } catch (e) {
        console.error('liqpay-callback error', e && e.message)
        return new Response('retry', { status: 500 })  // ретрай, а не тихая потеря платежа
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
