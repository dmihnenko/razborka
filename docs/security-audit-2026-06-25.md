# Аудит безопасности razborka.net — 2026-06-25

## ✅ Статус устранения (применено 2026-06-25)

| Находка | Статус |
|---|---|
| C1 `user_roles` USING(true) | ✅ Закрыто на проде (admin-write + owner→parts_worker; захват admin невозможен) |
| C2 `roles` USING(true) | ✅ Закрыто (запись только admin) |
| H1 `support_chats/messages` без RLS | ✅ RLS включён + политики owner/admin |
| H2 `company_subscriptions` | ✅ Чтение своя/admin, запись только admin |
| H3 `subscriptions` | ✅ Запись только admin |
| H4 `notify-user-registered` | ✅ Проверка JWT + личность из токена; задеплоено |
| H5 ImgBB-ключ в бандле | ✅ Перенесён в Edge `upload-image` (секрет `IMGBB_API_KEY`); убран из клиента/CI. **Требуется ротация старого ключа в панели ImgBB (вручную)** |
| H6 нет CSP/HSTS | ✅ Полный CSP: script/style/img/font/connect-src allowlist (supabase+wss, imgbb/cloudinary/freeimage, novaposhta, NHTSA VIN), frame-ancestors/HSTS/Permissions-Policy. script-src оставлен 'unsafe-inline' (2 инлайн-скрипта в index.html) — дальнейшее ужесточение хешами опционально |
| M1 `notifications` UPDATE без CHECK | ✅ Добавлен WITH CHECK |
| M2 `parts_storage_locations` anon | ✅ Сужено до `is_active AND market_published` |
| M3 `plain_password` | ✅ Колонка удалена (users+user_profiles), функция `create_user_account` не пишет пароль |
| M4 SW кеширует приватку | ✅ auth→NetworkOnly, storage/REST коротко, очистка `supabase-*` при logout |
| L1 `vehicle_share_links.code` перебор | ✅ anon-чтение таблицы кодов убрано; резолв кода и проверка шар-линка — через SECURITY DEFINER RPC (`validate_vehicle_share_code`, `vehicle_has_active_share`, `vehicle_share_code_taken`); проверено на проде (anon видит только расшаренные авто) |
| L2 опасные disable-RLS файлы | ✅ Перенесены в `database/_archive_DANGEROUS_do_not_run/` |

Миграции: `2026-06-25_security_hardening.sql`, `2026-06-25_drop_plain_password.sql`, `2026-06-25_share_links_hardening.sql` (применены через Management API, сверены `pg_policies` + anon-REST). Edge: `notify-user-registered`, `upload-image` (задеплоены).

**Остаётся вручную:** ротация старого ImgBB-ключа в панели ImgBB (он был в бандле до этого релиза).

---


Комплексный аудит силами 5 профильных агентов (RLS/мультитенант, Edge Functions, секреты, клиентская авторизация, PWA/заголовки). **Критичные находки по БД сверены с живым продом** (`hwckvddevjucuzxdoqqh`, `pg_policies` через Management API) — отмечено ✅ ПОДТВЕРЖДЕНО НА ПРОДЕ.

> Важно: ряд старых находок из файлов миграций (анонимный дамп `parts_*` через `USING(true)`) на проде **уже перекрыт** — `parts_orders/parts_customers/parts_inventory` изолированы корректно. Ниже только реально актуальное.

---

## Сводка по severity

| # | Находка | Severity | Статус |
|---|---------|----------|--------|
| C1 | `user_roles` — `ALL USING(true) CHECK(true)` → самоназначение роли **admin** | 🔴 CRITICAL | ✅ подтверждено на проде |
| C2 | `roles` — `ALL USING(true)` → правка справочника ролей любым | 🔴 CRITICAL | ✅ подтверждено на проде |
| H1 | `support_chats` / `support_messages` — **RLS выключен, 0 политик** | 🟠 HIGH | ✅ подтверждено на проде |
| H2 | `company_subscriptions` — `ALL USING(true)` → правка чужих подписок, обход лимитов тарифа | 🟠 HIGH | ✅ подтверждено на проде |
| H3 | `subscriptions` — `ALL USING(true)` → правка тарифного каталога (`has_analytics`, лимиты) | 🟠 HIGH | ✅ подтверждено на проде |
| H4 | Edge `notify-user-registered` — нет проверки прав вызывающего (service role + broadcast) | 🟠 HIGH | по коду |
| H5 | `VITE_IMGBB_API_KEY` — приватный ключ ImgBB в клиентском бандле | 🟠 HIGH | по коду |
| H6 | Нет CSP / HSTS / Permissions-Policy в `public/_headers` | 🟠 HIGH | по коду |
| M1 | `notifications.notif_update` — UPDATE без `WITH CHECK` → подмена `user_id` | 🟡 MEDIUM | ✅ подтверждено на проде |
| M2 | `parts_storage_locations` — anon SELECT по `is_active`, не `market_published` | 🟡 MEDIUM | ✅ подтверждено на проде |
| M3 | `users.plain_password` — пароли в открытом виде | 🟡 MEDIUM | по коду |
| M4 | SW кеширует приватные REST/Storage-ответы; кеши не чистятся при logout | 🟡 MEDIUM | по коду |
| L1 | `vehicle_share_links.code` читается anon → перебор 4-знач. кодов | 🟢 LOW | по коду |
| L2 | Устаревшие/опасные `*_disable_rls*.sql`, `force_disable_rls.sql` в репо | 🟢 LOW | гигиена |

**XSS — чисто** (нет `dangerouslySetInnerHTML`/`eval`). **Секреты в git — чисто** (история без утечек, `*.local` игнорируются). **Edge Functions** `create-user/delete-user/reset-password/update-user/impersonate` — образцовая проверка прав. **Auth-конфиг** (PKCE) корректен.

---

# ПРОМПТ ПО УСТРАНЕНИЮ (для исполнителя)

> Контекст: мульти-тенант CRM, Supabase Postgres + RLS, изоляция по `parts_company_id`. Хелперы уже есть в БД: `is_admin()`, `is_my_parts_company(uuid)`, `my_parts_company_id()` (все `SECURITY DEFINER`). Создание пользователей идёт через `SECURITY DEFINER`-функции и Edge `create-user`, не через прямой `INSERT` в `user_roles` с клиента. Миграции применяются вручную через Management API (см. `prod-db-manual-migrations.md`), файл — в `database/migrations/2026-06-25_security_hardening.sql`. После применения сверить `pg_policies`.

## Этап 1 — КРИТИЧНО (применить немедленно, ломает захват прав)

Создать `database/migrations/2026-06-25_security_hardening.sql`:

```sql
-- ============ C1: user_roles — запись только admin, чтение свои/компания/admin ============
drop policy if exists "Allow authenticated users to manage user_roles" on public.user_roles;
drop policy if exists "Allow authenticated users to read user_roles"   on public.user_roles;

create policy user_roles_select on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or user_id in (select id from public.user_profiles
                   where parts_company_id = public.my_parts_company_id())
  );
-- запись ролей — только admin (легитимное создание идёт через SECURITY DEFINER функции, они обходят RLS)
create policy user_roles_admin_write on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ C2: roles — справочник, запись только admin ============
drop policy if exists "Allow authenticated users to manage roles" on public.roles;
-- чтение оставляем (нужно для резолва имён ролей в UI)
create policy roles_admin_write on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H2: company_subscriptions — чтение своя/admin, запись только admin ============
drop policy if exists "Allow admin to manage company_subscriptions"        on public.company_subscriptions;
drop policy if exists "Allow authenticated users to read company_subscriptions" on public.company_subscriptions;

create policy company_subscriptions_select on public.company_subscriptions for select to authenticated
  using (public.is_admin()
         or (company_type = 'parts' and company_id = public.my_parts_company_id()));
create policy company_subscriptions_admin_write on public.company_subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H3: subscriptions (каталог тарифов) — запись только admin ============
drop policy if exists "Allow admin to manage subscriptions" on public.subscriptions;
-- публичное/authenticated чтение оставляем (Public read active parts plans)
create policy subscriptions_admin_write on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H1: support_chats / support_messages — включить RLS ============
alter table public.support_chats    enable row level security;
alter table public.support_messages enable row level security;

create policy support_chats_rw on public.support_chats for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy support_messages_rw on public.support_messages for all to authenticated
  using (chat_id in (select id from public.support_chats where owner_id = auth.uid())
         or public.is_admin())
  with check (chat_id in (select id from public.support_chats where owner_id = auth.uid())
              or public.is_admin());

-- ============ M1: notifications — добавить WITH CHECK на UPDATE ============
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ M2: parts_storage_locations — anon только для опубликованных витрин ============
drop policy if exists parts_storage_locations_public_select on public.parts_storage_locations;
create policy parts_storage_locations_public_select on public.parts_storage_locations for select to anon
  using (parts_company_id in (select id from public.parts_companies
                              where is_active and market_published));
```

**После применения** — сверка:
```sql
select c.relname, p.polname, p.polcmd, pg_get_expr(p.polqual,p.polrelid),
       pg_get_expr(p.polwithcheck,p.polrelid)
from pg_policy p join pg_class c on c.oid=p.polrelid
where c.relname in ('user_roles','roles','company_subscriptions','subscriptions',
                    'support_chats','support_messages','notifications','parts_storage_locations');
```
Smoke-тест: войти под обычным юзером (`user`) → попытка `INSERT` в `user_roles` роли admin должна вернуть RLS-ошибку; кабинет/маркет/одобрение заявок админом — работают как раньше.

> ⚠️ Перед применением проверить, что approve-логика (`adminService.approveAccessRequest`) и онбординг присваивают роли через `SECURITY DEFINER` RPC или Edge, а не прямым клиентским `INSERT user_roles`. Если где-то прямой клиентский insert — перенести в RPC `claim_*`/Edge `create-user` (паттерн уже есть), иначе после фикса C1 эти сценарии перестанут работать. Проверить файлы: `src/services/adminService.ts`, онбординг `/welcome`.

## Этап 2 — HIGH (код/инфра)

**H4 — `supabase/functions/notify-user-registered/index.ts`:** добавить верификацию JWT в начале и брать личность из токена, не из тела:
```ts
const authHeader = req.headers.get('Authorization')
if (!authHeader) return json(401, { error: 'Unauthorized' })
const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
if (error || !user) return json(401, { error: 'Invalid token' })
// payload собирать из user.id / user.email, поля из body игнорировать или сверять с user.id
```
Деплой вручную (`supabase functions deploy notify-user-registered`).

**H5 — ImgBB ключ:** убрать `VITE_IMGBB_API_KEY` из клиента. Перенести загрузку за прокси (Edge Function с `Deno.env.get('IMGBB_API_KEY')` или Cloudflare Worker `/api/upload`); клиент шлёт файл на свой эндпоинт. После переноса — **ротировать ключ** в панели ImgBB (текущий считать скомпрометированным), убрать из `.env`, `vite.config.ts`, `.github/workflows/deploy.yml`. Затронуто: `src/utils/imageStorage.ts:83`.

**H6 — security headers** (`public/_headers`, блок `/*`): добавить CSP + HSTS + Permissions-Policy + `frame-ancestors 'none'`. Готовый блок (origin'ы выверены по факту использования: Supabase REST/auth/storage/realtime, ImgBB/Cloudinary/freeimage, Google Fonts/OAuth):
```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://i.ibb.co https://image.ibb.co https://res.cloudinary.com https://iili.io https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.imgbb.com https://api.cloudinary.com https://freeimage.host https://accounts.google.com; frame-src https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()
```
`script-src 'unsafe-inline'` — временно (2 инлайн-скрипта в `index.html`); цель — вынести их в файлы и заменить на `script-src 'self'`. `'unsafe-eval'` НЕ добавлять. После включения — проверить консоль на CSP-violations.

## Этап 3 — MEDIUM/LOW

- **M3 — `users.plain_password`:** убрать колонку и запись `plain_password` из `create_user_account`. Сбросить значения существующих строк (`update ... set plain_password = null`). Пароли восстанавливаются только через `reset-password`.
- **M4 — Service Worker (`vite.config.ts` runtimeCaching):** `auth`-запросы → `NetworkOnly` (не кешировать токены); `storage` вынести отдельным правилом, `maxAgeSeconds` 60; REST — снизить до 60–120 с; убрать `statuses:[0]` из supabase-правил. В обработчик logout добавить очистку `caches` с префиксом `supabase-`.
- **L1 — `vehicle_share_links`:** не отдавать `code` анониму напрямую; валидацию кода вынести в `SECURITY DEFINER` RPC.
- **L2 — гигиена репо:** удалить/переместить в архив устаревшие `database/force_disable_rls.sql`, `database/fix_*_rls_temp.sql`, `database/disable_parts_vehicles_rls_temp.sql`, ранние `parts_step1_tables.sql`/`parts_system_full.sql` — их хвосты `DISABLE ROW LEVEL SECURITY` опасны при случайном повторном прогоне. Зафиксировать актуальную RLS-схему одним консолидированным файлом.

---

## Что хорошо (подтверждено)
- `parts_orders/parts_order_items/parts_customers/parts_inventory/parts_vehicles/parts_categories` — RLS вкл, корректная изоляция по компании + admin; anon-чтение инвентаря сужено до `available + market_published`, без `purchase_price`/`notes`.
- `revoke_anon_writes` отозвал INSERT/UPDATE/DELETE/TRUNCATE у anon глобально.
- `user_profiles` защищён триггером-стражем от смены `parts_company_id`/`role_id`.
- Edge `create-user/delete-user/reset-password/update-user/impersonate` — проверяют права вызывающего по JWT до операции; `impersonate` запрещает вход под другим админом.
- Auth PKCE-конфиг, отсутствие XSS, чистая git-история по секретам, корректный CORS-allowlist в Edge и заголовки `X-Frame-Options`/`nosniff`/`Referrer-Policy`.
