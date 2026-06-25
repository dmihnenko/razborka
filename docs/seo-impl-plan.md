# SEO P0 — план реализации (edge-мета + sitemap + JSON-LD) на Cloudflare Worker

Стек: React SPA (Vite→dist) на Cloudflare Worker + Static Assets. Полного SSR нет и не нужно — внедряем **edge-инъекцию мета** в `worker/index.js` (HTMLRewriter), Worker-роут `/sitemap.xml`, JSON-LD, обновляем `robots.txt`. Публичные данные берём анонимно из Supabase (RLS защищает приватное).

## Константы (worker)
- `SITE = 'https://razborka.net'`
- `SUPABASE_URL`, `ANON_KEY` — публичные (anon-ключ уже в бандле; защита через RLS). Передать через `vars` в wrangler.jsonc.
- `DEFAULT_OG = SITE + '/pwa-512x512.png'` (фолбэк og:image; позже заменить на баннер 1200×630 `/og-default.png`).
- `BRAND = 'Razborka.net'`

## Точные формы данных (сверено на проде)
- `POST /rest/v1/rpc/get_public_parts_item {p_id}` → `{ id, name, part_number, article, condition, description, photos:[{url,medium_url,thumb_url}], photo_url, price_currency('UAH'|'USD'), selling_price, status, parts_company_id, category:{name}|null, vehicle:{make,model,year}|null }`. У товара без фото `photos:[]`, `photo_url:null` → og:image = DEFAULT_OG.
- `POST /rest/v1/rpc/get_market_suppliers {}` → `[{ id, name, phone, telegram, address, city, email, description, available_parts }]`. Для одной разборки — фильтровать по id из списка.
- `GET /rest/v1/market_inventory?select=id` → список id публичных товаров (для sitemap; view уже отфильтрован published+available).
- Заголовки запросов: `apikey: ANON_KEY`, `Authorization: Bearer ANON_KEY`.

## Маршруты и мета

| Маршрут | Индекс | title | description | og:image | JSON-LD | canonical |
|---|---|---|---|---|---|---|
| `/` , `/market` | да | `Razborka.net — маркет б/у запчастей от авторазборок` | маркет-оффер | DEFAULT_OG | Organization+WebSite | self |
| `/market/catalog` | да | `Каталог запчастей — Razborka.net` | каталог | DEFAULT_OG | BreadcrumbList | self (без query) |
| `/market/suppliers` | да | `Авторазборки — Razborka.net` | список разборок | DEFAULT_OG | — | self |
| `/market/part/:id` | да | `${name} — ${make} ${model} ${year} \| Razborka.net` | `${name}. Состояние: ${condLabel}. Цена ${price} ${cur}. Авто: ${make} ${model} ${year}.` | photos[0].medium_url\|\|url \|\| DEFAULT_OG | Product+Offer (price,currency,availability,itemCondition,image,brand) + BreadcrumbList | self |
| `/public/parts-item/:id` | да | как товар | как товар | как товар | как товар | **→ `/market/part/:id`** (дедуп) |
| `/market/supplier/:id` | да | `${name} — авторазборка${city?', '+city:''} \| Razborka.net` | `${name}. ${available_parts} запчастей. ${address}.` | DEFAULT_OG | LocalBusiness (name,telephone,address,areaServed) | self |
| `/public/parts-location/:id` | да | `Место хранения — Razborka.net` (или RPC-данные, если есть) | — | DEFAULT_OG | — | self |
| `/business`, `/business/apply`, `/landing` | да | бизнес-лендинг | оффер для разборок | DEFAULT_OG | — | self |
| `/market/cart`, `/welcome`, `/login`, `/reset-password`, `/vehicle-access`, `/public/parts-customer/*`, `/public/personal-vehicle/*` | **noindex** | generic | — | — | — | — |

condLabel: new→«Новая», used→«Б/У», damaged→«Под восстановление». price: `selling_price.toLocaleString('uk-UA')`. availability: status==='available' → `InStock`, иначе `OutOfStock`. itemCondition: new→`NewCondition`, used/damaged→`UsedCondition`/`RefurbishedCondition`.

## Worker-алгоритм (`worker/index.js`)
1. `/api/privatbank-rate` — как есть.
2. `/sitemap.xml` → `buildSitemap(env)` (кеш `caches.default`, TTL ~1ч): `<urlset>` со static-маршрутами (`/`, `/market`, `/market/catalog`, `/market/suppliers`, `/business`) + по товару `/market/part/{id}` (из `market_inventory?select=id`) + по разборке `/market/supplier/{id}` (из `get_market_suppliers`). `Content-Type: application/xml`.
3. Иначе: `route = matchRoute(pathname)`. Если route публичный И это HTML-навигация (`Accept` содержит `text/html` или `Sec-Fetch-Dest: document`):
   - кеш `caches.default` по URL (TTL ~5–10 мин) → если есть, отдать.
   - `const res = await env.ASSETS.fetch(request)` (вернёт index.html через SPA-fallback).
   - `meta = await computeMeta(route, env)` (для product/supplier — fetch данных; на ошибке → generic + НЕ ломать страницу).
   - `HTMLRewriter`: переписать `<title>`, `<meta name=description>`; добавить в `<head>` canonical, OG (`og:title/description/image/url/type`), twitter:card, JSON-LD `<script type=application/ld+json>`, и `<meta name=robots content=noindex>` для noindex-маршрутов.
   - положить в кеш, отдать.
4. Иначе — `env.ASSETS.fetch(request)` (статика, без изменений).

**Надёжность:** любой сбой fetch данных → generic-мета, страница ВСЕГДА отдаётся (try/catch вокруг computeMeta и data-fetch). Кеш короткий (цена/статус меняются). Не блокировать рендер надолго — таймаут на Supabase-fetch ~2–3с, иначе generic.

## wrangler.jsonc
- `vars: { SUPABASE_URL, SUPABASE_ANON_KEY }` (публичные).
- `run_worker_first`: добавить публичные HTML-маршруты + sitemap, НЕ ассеты:
  `["/api/*", "/", "/market", "/market/*", "/public/*", "/business", "/business/*", "/landing", "/sitemap.xml"]`.
  (Ассеты `/assets/*`, картинки, `/robots.txt` и пр. НЕ в списке → отдаются edge напрямую, без расхода воркера.)

## robots.txt (public/robots.txt — статика)
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /parts/
Disallow: /users
Disallow: /support
Disallow: /profile
Disallow: /welcome
Disallow: /my-vehicles
Disallow: /login
Disallow: /reset-password
Disallow: /vehicle-access
Disallow: /market/cart
Disallow: /public/parts-customer
Disallow: /public/personal-vehicle

Sitemap: https://razborka.net/sitemap.xml
```

## Проверка после деплоя (Worker нельзя тестить локально без wrangler dev)
- `curl -s https://razborka.net/market/part/<id>` → уникальный `<title>`, `og:image` = фото товара, Product JSON-LD.
- `curl -s https://razborka.net/sitemap.xml` → валидный XML с товарами/разборками (не SPA-HTML).
- `curl -s https://razborka.net/robots.txt` → Disallow + Sitemap.
- Шеринг: og:image/title корректны (validator).
- Регресс: обычная загрузка SPA работает (мета не ломает приложение), ассеты отдаются без воркера.

## Дальше (P1, отдельно)
- react-helmet-async для клиентского обновления title при SPA-навигации (UX вкладки; SEO уже закрыт воркером).
- Баннер `/og-default.png` 1200×630. www→apex редирект. hreflang/locale-в-URL.
