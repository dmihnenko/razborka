# План развития TSP / AutoRozborka: безопасность · масштаб · SEO

## Состояние сейчас

Продукт функционально зрелый: мульти-тенантный CRM разборок + публичный маркет на React 18 + Vite + Supabase + Netlify, с PWA и оффлайн-кэшем. Но под ним три системных риска. **Critical-1 (безопасность):** RLS отключена на шести таблицах разборки (`parts_inventory`, `parts_orders`, `parts_order_items`, `parts_customers`, `parts_categories`, `parts_vehicles`) + политики `TO anon USING(true)` — любой аноним с публичным anon-key читает себестоимость, телефоны клиентов и заказы **всех** арендаторов; фронтовый `PART_FIELDS` ничего не защищает. **Critical-2 (масштаб):** `getPartsInventory` грузит весь склад без `.range()` с трёх страниц сразу, поиск маркета — `ilike '%q%'` без pg_trgm; при 100k строк это seq-scan на каждый запрос анонима. **Critical-3 (SEO):** маркет — SPA с пустым `div#root`, одинаковыми title/description, без sitemap/OG/JSON-LD — публичный каталог фактически невидим для поиска и мессенджеров.

## ТОП-приоритеты

1. 🔒 **Включить RLS на 6 таблицах разборки + VIEW `market_inventory` для анонима** — единственный реальный барьер, anon-key уже в бандле у всех; утечка = GDPR/закон Украины + коммерческая тайна. Блокирует всё остальное по безопасности. **(M)**
2. 🔒 **Закрыть `USING(true)`-политики на `user_profiles`, `parts_companies`, `company_subscriptions`, `trash_bin`** — сейчас любой authenticated может изменить чужую компанию, чужой профиль (включая смену своего `parts_company_id` → захват тенанта) и подписку конкурента. **(S)**
3. ⚡ **Индексы parts_inventory/parts_orders + pg_trgm для поиска** — чистый SQL, ноль изменений фронта, снимает seq-scan'ы публичного каталога до того, как маркет вырастет. **(S)**
4. ⚡ **Серверная пагинация `getPartsInventory` + фильтры на сервере** — главный убийца масштаба: весь склад в JSON × 3 страницы одновременно; при 10k+ позиций приложение деградирует первым. **(L)**
5. 🔎 **react-helmet-async: динамические title/description/OG/canonical на всех `/market/*`** — 80% SEO-ценности за день работы; без этого даже проиндексированные страницы имеют нулевой CTR, а ссылки в Telegram/Viber — пустышки (основной канал разборок). **(S)**
6. ⚡ **Агрегаты на БД вместо клиентской агрегации: RPC `get_parts_dashboard_stats`, фикс N+1 в `getMarketSuppliers`, `count:'estimated'` в каталоге** — дашборд сейчас инициирует до 13 параллельных запросов, часть тянет полные таблицы; N+1 по поставщикам растёт линейно с числом разборок. **(M)**
7. 🔎 **sitemap.xml через Netlify Function + robots.txt с Disallow закрытых разделов** — без sitemap краулер не найдёт карточки `/market/part/:uuid` в SPA вообще. **(M)**
8. 🔒 **Edge Functions/секреты: безусловная проверка `TELEGRAM_WEBHOOK_SECRET`, проверка `__NOTIFY_SECRET__` в prod-БД, REVOKE anon с `generate_parts_order_number`, rate-limit `submit_marketplace_order`** — точечные дыры с дешёвым фиксом. **(S)**
9. 🔎 **JSON-LD Product/Offer на карточке товара + AutoPartsStore на поставщике** — цена в выдаче Google = главное конкурентное преимущество для запчастей. **(M)**
10. ⚡🔎 **Код-сплиттинг vendor.js (framer-motion, jspdf — динамический импорт) + чистка PWA precache** — −300 КБ с критического пути маркета, прямой вклад в LCP и Core Web Vitals. **(M)**

## Безопасность

### Главное: RLS + безопасный публичный слой (без поломки каталога)

Порядок применения миграций — **вручную через Supabase** (prod отстаёт от репо, миграции применяются руками — это уже конвенция проекта). Ключевой принцип: **сначала создаём публичные VIEW и переключаем фронт, потом включаем RLS** — так каталог не ломается ни на минуту.

**Шаг 0 — аудит фактического состояния prod (до любых изменений):**
```sql
-- что реально применено в prod
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
SELECT * FROM pg_policies WHERE schemaname='public';
-- проверить, не применён ли NOTIFY_SECRET плейсхолдером
SELECT prosrc FROM pg_proc WHERE proname = 'notify_marketplace_order'; -- не должно содержать __NOTIFY_SECRET__
```

**Шаг 1 — публичные VIEW только с безопасными полями (применить, фронт ещё не трогаем):**
```sql
CREATE VIEW public.market_inventory AS
SELECT id, name, part_number, description, condition, quantity, reserved_quantity,
       selling_price, price_currency, photo_url, photos, status,
       parts_company_id, category_id, vehicle_id
FROM parts_inventory
WHERE status = 'available' AND selling_price > 0;
GRANT SELECT ON public.market_inventory TO anon;

CREATE VIEW public.market_vehicles AS
SELECT id, make, model, year FROM parts_vehicles; -- без purchase_price/VIN/notes
GRANT SELECT ON public.market_vehicles TO anon;
```
(VIEW наследуют права owner'а — после включения RLS пометить `security_invoker = off` осознанно либо использовать `security_barrier`; проверить, что VIEW не протекает.)

**Шаг 2 — переключить `marketplaceService.ts`:** `getMarketParts` / `getMarketPart` / `getRelatedParts` / `getMarketCategories` / `getMarketMakes` с `.from('parts_inventory')` на `.from('market_inventory')`, джойн авто — на `market_vehicles`. Задеплоить фронт, убедиться, что маркет работает.

**Шаг 3 — включить RLS и снести anon-политики (одна миграция, prod):**
```sql
ALTER TABLE parts_inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_vehicles    ENABLE ROW LEVEL SECURITY;

-- снести наследие add_public_access_policies.sql (включая СТО-таблицы appointments/vehicles/customers, если ещё живы)
DROP POLICY IF EXISTS "Allow public read ..." ON parts_inventory; -- и далее по списку из pg_policies (шаг 0)

-- тенантные политики (паттерн для всех шести таблиц)
CREATE POLICY parts_inv_tenant ON parts_inventory FOR ALL TO authenticated
USING (parts_company_id IN (SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()))
WITH CHECK (parts_company_id IN (SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()));
```
Для `parts_categories` анониму — SELECT-политика только если категории нужны маркету (там лишь id/name), иначе через VIEW.

**Шаг 4 — смоук-тест изоляции:** curl с anon-key к `/rest/v1/parts_inventory` → должен вернуть `[]`/403; к `/rest/v1/market_inventory` → данные; залогиненный worker компании A не видит строки компании B. Зафиксировать как Playwright e2e «security smoke».

### Изоляция тенантов на служебных таблицах

- **`user_profiles`** (`fix_user_profiles_rls.sql` — `FOR ALL USING(true)`): разделить — SELECT: своя строка + коллеги по `parts_company_id` + admin; UPDATE/INSERT: только `id = auth.uid()` (и **запретить смену `parts_company_id` самим пользователем** — `WITH CHECK` или колоночный trigger), admin — всё. Это критично: через смену company_id обходится вся тенантная изоляция шага 3.
- **`parts_companies`** (`add_companies.sql:79-84`): SELECT — всем authenticated (нужно маркету/каталогу), запись — только своя компания или admin.
- **`company_subscriptions`** (`add_subscriptions.sql:85-96`): SELECT — своя компания + admin; INSERT/UPDATE/DELETE — только admin.
- **`trash_bin`** (`add_trash_bin.sql`): `ENABLE ROW LEVEL SECURITY` + политика по `parts_company_id`, `REVOKE ALL FROM anon` — там полные JSONB удалённых сущностей.

### Edge Functions и секреты

- **telegram-bot:** заменить условную проверку на fail-closed: `if (!WEBHOOK_SECRET || got !== WEBHOOK_SECRET) return 403`. Проверить `supabase secrets list`. Деплой вручную (`supabase functions deploy telegram-bot`) — по конвенции репо.
- **NOTIFY_SECRET:** по результату шага 0 — если в `prosrc` плейсхолдер, немедленно переприменить функцию; долгосрочно перенести секрет в Supabase Vault (`vault.decrypted_secrets`).
- **`generate_parts_order_number`:** `REVOKE EXECUTE ... FROM anon` (fix_order_number_counter.sql, parts_orders.sql, parts_step2_functions.sql).
- **`submit_marketplace_order`:** анти-спам внутри RPC — отказ при дубле `buyer_phone + parts_company_id` за 10 минут; honeypot-поле + disabled-кнопка на фронте. Защищает и Telegram-уведомления от флуда.
- **imgbb-ключ:** убрать `VITE_IMGBB_API_KEY` из бандла/Netlify env; Edge Function `upload-image` с проверкой JWT и серверным ключом (по паттерну `create-user`).
- **impersonate:** минимум — audit log в activity_log на каждый вызов; редизайн с HttpOnly-cookie — в Этап 3.

## Производительность и масштаб

### Сделать ДО роста (проактивно)

**1. Индексы — одна ручная миграция, эффект мгновенный, риск нулевой:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- внутренний склад
CREATE INDEX CONCURRENTLY idx_inv_company_status  ON parts_inventory(parts_company_id, status);
CREATE INDEX CONCURRENTLY idx_inv_company_created ON parts_inventory(parts_company_id, created_at DESC);
-- публичный каталог (partial — ровно под предикат маркета)
CREATE INDEX CONCURRENTLY idx_inv_market ON parts_inventory(status, selling_price)
  WHERE status = 'available' AND selling_price > 0;
CREATE INDEX CONCURRENTLY idx_inv_category ON parts_inventory(category_id) WHERE category_id IS NOT NULL;
-- заказы
CREATE INDEX CONCURRENTLY idx_orders_company_date ON parts_orders(parts_company_id, order_date DESC);
-- поиск: trigram вместо seq-scan на ilike '%q%'
CREATE INDEX CONCURRENTLY idx_inv_name_trgm    ON parts_inventory USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_inv_partnum_trgm ON parts_inventory USING gin(part_number gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_inv_desc_trgm    ON parts_inventory USING gin(description gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_pvehicle_make_trgm ON parts_vehicles USING gin(make gin_trgm_ops);
```
Поиск остаётся `ilike '%q%'` в `marketplaceService.ts:104-111` — GIN-trgm его ускорит без изменения кода. Переход на `to_tsvector` + RPC — только если по `pg_stat_statements` trgm не хватит (реактивно).

**2. Пагинация `getPartsInventory` (partsService.ts:313):** параметры `page/pageSize/search/status/vehicleId` → `.range(from, to)` + фильтры на сервер; убрать клиентский `filteredAndSorted` из `PartsInventory.tsx:299-331`. Для `PartsCustomerProfile.tsx:96` — отдельный лёгкий запрос (id/name/price/status по `sold_to_customer`), чтобы профиль клиента не тянул весь склад. Виртуализация через `@tanstack/react-virtual` — после пагинации, если страницы крупные.

**3. Устранение N+1 и клиентских агрегаций — пакет RPC (одна миграция):**
- `get_market_supplier_counts()` — заменяет `Promise.all` из 21+ count-запросов в `getMarketSuppliers` (marketplaceService.ts:197-208) одним `GROUP BY parts_company_id` (работает по partial-индексу `idx_inv_market`-семейства).
- `get_parts_dashboard_stats(p_company_id) RETURNS json` — SUM/COUNT на сервере вместо выгрузки всего склада в `PartsDashboard.tsx:59-93`; туда же агрегаты для `PartsAnalytics.tsx:33-46`.
- `get_onboarding_status(p_company_id) RETURNS json` — 5 count-запросов `OnboardingChecklist` → один; счётчики лимитов `useSubscription` — staleTime 10 мин. Итог: 13 параллельных запросов на дашборде → 3-4.
- `getPartsCategoriesUsage` → `select('category_id, count:category_id.count()')` (PostgREST-агрегация, без RPC).

**4. Каталог маркета:** `count:'exact'` → `count:'estimated'` (marketplaceService.ts:97); счётчики категорий (`.limit(5000)` + JS, строки 237-262) и `getMarketMakes` → materialized view `market_category_counts` с `REFRESH ... CONCURRENTLY` по pg_cron (раз в 5-15 мин — для каталога этого достаточно).

**5. Бандл:** в `vite.config.ts` manualChunks — `framer-motion → vendor-motion`, `react-select`, `fuse.js`, `react-photo-view` — отдельные чанки; **jspdf — только динамический `await import('jspdf')` по клику «Экспорт PDF»** (~300 КБ долой из критического пути). PWA: `globIgnores: ['**/pwa-*.png','**/maskable-*.png','**/apple-touch-*.png']` — precache 2.2 МБ → ~1.7 МБ на каждый деплой.

**6. Persist-кэш (main.tsx:131-138):** добавить в исключения `shouldDehydrateQuery` ключи `parts-inventory-stats`, `parts-orders-stats`, `parts-vehicles-stats`, `parts-customers-stats`, `parts-analytics`, `market-parts`; обернуть persister в try/catch на `QuotaExceededError` (деградация без поломки PWA — у проекта уже была история с broken-state спиннером).

### Реактивно, по метрикам (не делать заранее)

- FTS (`tsvector`) — если p95 поиска > 300 мс при trgm-индексах.
- `getPartsOrders` без join items (заголовки списком, items по клику) — когда у компаний появятся 500+ заказов.
- IndexedDB-персистер вместо localStorage — при первых QuotaExceeded в Sentry/логах.
- Переезд изображений с imgbb на Supabase Storage/Cloudflare Images — при росте трафика маркета (даст и SEO-бонус, см. ниже).
- Включить `pg_stat_statements` и смотреть топ-запросы раз в спринт — это и есть триггер для всего реактивного списка.

## SEO

**Корень проблемы:** Vite SPA — краулер получает пустой `div#root` и одинаковые мета на всех роутах. Полный SSR (Next/Remix) — переписывание роутинга, не оправдан сейчас. Реалистичная стратегия под Netlify+Vite — слоями:

1. **Слой 1 — мета без рендеринга (S, делать первым):** `react-helmet-async`; хук `useSEO(part)` для маркета. По роутам: `MarketProductPage` — `title = "{part.name} — {company.name} | Маркет запчастей"`, description с состоянием/ценой, `og:type=product`, `og:image={part.photoUrl}` (imgbb-URL валиден как og:image), canonical `https://tsp.pp.ua/market/part/{id}`; `MarketSupplierPage` — название + город, `og:type=website`; `MarketCatalog` — canonical всегда `/market/catalog` без query (фильтры не индексируем). Базовые правки `index.html`: description → «Б/у и новые автозапчасти от авторазборок Украины — с фото, ценами и контактами продавца», `og:site_name`, `og:locale=ru_UA`, `lang="uk"` либо `ru` + hreflang `ru-UA`. Мессенджер-превью (Telegram/Viber) заработают только для роутов с пререндером/функцией — боты не исполняют JS — поэтому слой 1 обязательно дополняется слоем 3 для карточек.
2. **Слой 2 — sitemap + robots (M):** Netlify Function `netlify/functions/sitemap.ts` — читает `market_inventory` (безопасный VIEW из раздела безопасности — анон-функция не должна трогать сырую таблицу) и активные `parts_companies`, отдаёт XML с `Cache-Control: public, max-age=3600`; redirect в `netlify.toml`: `/sitemap.xml → /.netlify/functions/sitemap`. `robots.txt`: `Disallow: /parts/`, `/admin/`, `/login`, `/profile`, `/market/cart` + `Sitemap: https://tsp.pp.ua/sitemap.xml`.
3. **Слой 3 — HTML для краулеров и ботов (L):** статичные публичные роуты (`/market`, `/market/catalog`, `/market/suppliers`, `/business`) — пререндер на этапе сборки (vite-plugin-prerender / react-snap); динамические карточки `/market/part/:id` — Netlify Function (on-demand/edge), которая для запросов ботов (UA-детект или для всех) рендерит лёгкий HTML с мета + JSON-LD + основным контентом и кэшируется CDN. Это решает и OG-превью, и «вторую волну» индексации.
4. **JSON-LD (M):** в том же `useSEO` — `Product`+`Offer` (price, priceCurrency, availability InStock/OutOfStock) на карточке; `AutoPartsStore` (name, telephone, address) на поставщике; `BreadcrumbList` поверх существующих визуальных крошек. Цена в сниппете выдачи — главный CTR-рычаг для запчастей.
5. **Slug-URL (M, после слоёв 1-3):** колонка `slug` в `parts_inventory` (транслит имени + `substr(id,1,8)`, unique), роут `/market/part/:slug` с fallback по UUID для старых ссылок. Не срочно: title/canonical Google весит больше URL.
6. **Core Web Vitals:** пересекается с perf — выделение framer-motion из vendor (или замена на CSS-transitions в маркете), `width/height` + `fetchpriority="high"` на LCP-фото карточки, `loading="lazy"` для карточек сетки кроме первых четырёх; перелинковка — секция «Похожие в категории» (`getMarketParts({categoryId})`) + ссылки на топ-категории в футере маркета.

## Этапы внедрения

### Этап 1 — Срочно: закрыть данные (≈1-2 недели)
Безопасность не ждёт роста — дыра эксплуатируема уже сейчас.
- Аудит prod (`pg_policies`, `prosrc` notify-функции) → VIEW `market_inventory`/`market_vehicles` → переключение `marketplaceService` → включение RLS на 6 таблицах + DROP anon-политик (шаги 0-4).
- Политики `user_profiles` / `parts_companies` / `company_subscriptions` / `trash_bin`.
- Edge-фиксы: fail-closed telegram-bot, REVOKE anon, анти-спам в `submit_marketplace_order`.
- **Параллелится без конфликтов:** миграция индексов + pg_trgm (пункт 1 perf) — чистый SQL; и правка `index.html` (description/OG/lang) — одна строка кода.
- Контроль: security-smoke e2e (anon не читает сырые таблицы), маркет работает на VIEW.

### Этап 2 — Масштаб + SEO-фундамент (≈3-5 недель)
Два независимых трека, можно вести параллельно (perf — бэкенд/сервисы, SEO — фронт):
- **Perf-трек:** пагинация `getPartsInventory` + лёгкий запрос для профиля клиента; пакет RPC (`get_parts_dashboard_stats`, `get_market_supplier_counts`, `get_onboarding_status`); `count:'estimated'` + matview категорий; manualChunks + динамический jspdf + globIgnores PWA; исключения persist-кэша.
- **SEO-трек:** react-helmet-async + `useSEO` (title/description/OG/canonical на все `/market/*`); sitemap-функция + robots.txt; JSON-LD Product/Store/Breadcrumb; width/height/fetchpriority на фото.
- Контроль: `build:check` + `lint` + `test` зелёные перед каждым пушем (с поправкой на известный baseline падающих Login/useAuth-тестов); Lighthouse на `/market` до/после.

### Этап 3 — Рост (по мере трафика)
- Пререндер статичных маркет-роутов + bot-рендеринг карточек через Netlify Function (полные OG-превью в мессенджерах).
- Slug-URL для карточек; hreflang при появлении uk-локализации; перелинковка «похожие/категории/футер».
- Виртуализация списков; FTS если trgm не хватает; `getPartsOrders` без items; Storage/CDN для фото вместо imgbb (+ Edge Function `upload-image` закрывает и imgbb-ключ).
- Impersonate → HttpOnly-cookie + audit log; NOTIFY_SECRET → Vault.

## Метрики успеха

**Безопасность (проверяется сразу после Этапа 1):**
- curl с anon-key к `/rest/v1/parts_inventory|parts_customers|parts_orders|trash_bin` → пусто/403; к `/rest/v1/market_inventory` → только safe-поля. Автоматизировано в e2e.
- `pg_policies`: ноль политик `USING(true)` на запись для не-admin; worker компании A не читает/не пишет данные компании B; пользователь не может сменить себе `parts_company_id`.
- POST на telegram-bot без секрета → 403; 10 заявок подряд с одного телефона → отказ RPC.

**Производительность:**
- p95 запроса каталога `/market/catalog` (поиск с текстом) < 300 мс по `pg_stat_statements` / Supabase dashboard при 50k+ строк.
- Открытие `/market/suppliers` = 1-2 запроса к БД (было 21+); открытие PartsDashboard ≤ 4 запросов (было ~13).
- Объём ответа `getPartsInventory` — константный (pageSize), не растёт со складом.
- vendor-чанк критического пути маркета < 200 КБ raw; precache < 1.8 МБ; ноль QuotaExceeded в логах.

**SEO (горизонт 4-12 недель после Этапа 2, Google Search Console):**
- Проиндексировано: статичные маркет-роуты + растущая доля карточек из sitemap (цель — >60% available-позиций за квартал).
- Уникальные title/description у 100% публичных страниц (проверка Screaming Frog); валидный Product-rich-result в Rich Results Test; превью ссылок в Telegram показывает фото+название+цену.
- Core Web Vitals на `/market`: LCP < 2.5 c (моб., p75), CLS < 0.1; Lighthouse SEO ≥ 95.
- Бизнес-метрика: рост организических переходов на `/market/*` и заявок `submit_marketplace_order` из органики месяц-к-месяцу.