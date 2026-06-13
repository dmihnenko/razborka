Я сведу три аудита в единый план-меню. Поскольку находки уже детальны и сослались на конкретные файлы/строки, мне не нужно перечитывать кодовую базу — задача синтеза и приоритезации. Сразу выдаю Markdown-план.

# План развития кабинета авторазборки (/parts/*)

## Состояние кабинета сейчас
После редизайна под kit база крепкая: компоненты `stat-card`, `modal-sheet`, `card`, `badge-*` консистентны, мобильный bottom-nav с safe-area работает, sticky-шапки есть на ключевых экранах, аналитика и маркетплейс-заявки покрыты. Три класса проблем тянут вниз: **(1) UX-регрессии адаптива** — 5 страниц без горизонтальных паддингов, тач-таргеты <44px, скрытые при hover действия, конфликты `z-40`; **(2) масштаб** — `getPartsInventory` грузит весь склад без пагинации сразу с 4 страниц, дашборд бьёт 6+ запросов с клиентской агрегацией, нет составных индексов; **(3) функциональные пробелы** ежедневного потока — нет глобального поиска, QR-этикеток, завершённого мобильного сценария приёмки авто. Срочнее всего — перф-фундамент (пагинация + индексы) и быстрые UX-фиксы: они дешёвые и снимают боль на 360px и на реальных объёмах данных.

## Быстрые победы (S, до 1 дня)
- 🎨 **Горизонтальные паддинги на 5 страницах** — заменить `w-full py-4 sm:py-6` на `page-container` в PartsInventory, PartsCustomers, PartsCategories, PartsEmployees, PartsSettings (контент упирается в края на 360px).
- 🎨 **z-index кнопки «Завершить заказ»** — поднять до `z-50` над nav-баром в PartsOrderDetails, добавить нижний спейсер `pb-[calc(64px+env(safe-area-inset-bottom))]`.
- 🎨 **Действия в таблице склада на тач** — заменить `opacity-0 group-hover/row` на `[@media(pointer:coarse)]:opacity-100` (кнопки edit/sell/delete недоступны без мыши).
- 🎨 **Bulk-bar под nav-баром** — поднять `bottom-4` до `bottom-[calc(1rem+64px+env(safe-area-inset-bottom))]` + `z-50` в PartsInventory.
- 🎨 **Кнопка «Назад» в PartsPageHeader** — `p-2` → `btn-icon` (сейчас ~36px, меньше 44px).
- 🎨 **`shadow-float` — несуществующий токен** — заменить на `shadow-lg` или inline-значение в PartsInventory.
- 🎨 **Иконки-кнопки без семантики** — `✕` → `<X/>` из lucide + `aria-label="Закрыть"` в AddItemModal/EditOrderModal; aria-label на действия в таблице запчастей PartsVehicleDetails.
- 🎨 **Переупорядочить мобильный bottom-nav** — Дашборд, Заказы, Запчасти, Клиенты первыми 4 в `partsOwnerMenu`/`partsWorkerMenu`.
- 🎨 **Grid «Управление» на дашборде** — `grid-cols-2` → `grid-cols-3` (убрать кривой layout 2+2+1).
- 🎨 **Footer-кнопки карточек** — `min-h-[44px]` в PartsCustomers/PartsEmployees/PartsCustomerProfile.
- ⚡ **Составные индексы в БД** (см. ниже SQL) — чистый SQL `CONCURRENTLY`, без изменений кода, минуты на применение.
- ⚡ **staleTime для usage-счётчиков** — поднять до 5-10 мин в `useSubscription.ts`, объединить два `count:exact`.
- ⚡ **OnboardingChecklist** — поднять staleTime до 10-30 мин + скрывать после завершения (флаг в localStorage).
- ⚡ **lazy ConveyorModal/SellModal/BulkSellModal** — `lazy()` + Suspense, грузить только при открытии (PartsInventory — монолит 2217 строк).
- 🧩 **QR-этикетки** — `npm i qrcode`, модалка с QR + `window.print()` в PartsWarehouse и PartsInventoryItemPage (рисует в canvas, без бэкенда).
- 🧩 **Конвейер со страницы авто** — импорт ConveyorModal в PartsVehicleDetails с предустановленным `vehicleId` (завершает мобильную приёмку).
- 🧩 **Снять ограничение `statusFilter === 'reserved'`** с чекбоксов в инвентаре — массовые операции при любом статусе.
- 🧩 **Доступ worker к Складу/Аналитике** — добавить 2 пункта в `partsWorkerMenu`, RLS не трогать.

## UX и адаптивность

### Адаптив, ориентации, контейнеры
- **5 страниц без `px`** — `page-container` вместо `w-full py-4 sm:py-6` (S, high).
- **Единая система контейнеров** — списки → `page-container` (max-w-1440), детали → `max-w-4xl mx-auto` + те же паддинги; привести PartsOrderDetails (hardcoded `max-w-7xl`) и PartsCreateOrder к правилу (M, medium).
- **Sticky-шапка профиля клиента** — убрать хаки с негативными `-mx-4...md:-mx-8`, перейти на `glass` + `border-b` как в PartsPageHeader (S, medium).
- **Графики PartsAnalytics на мобиле** — обернуть bar-chart в `overflow-x-auto scrollbar-hide` + `min-w-[480px]`, либо 6 месяцев на мобиле / 12 на десктопе (M, low).

### Размеры и переполнение
- **Stat-карточки на 360px** — `truncate`/`line-clamp-1` на kicker («Зарезервировано» = 12 симв.), `tabular-nums`, нет `overflow-hidden` на `.stat-card` (S, medium).

### Тач-таргеты (<44px)
- Кнопка «Назад» PartsPageHeader → `btn-icon` (S).
- Footer-кнопки PartsCustomers/PartsEmployees/PartsCustomerProfile → `min-h-[44px]` (S).
- Действия в таблице склада скрыты при hover → `[@media(pointer:coarse)]:opacity-100` (S, medium).

### Доступность
- `✕` → `<X/>` + `aria-label` в модалках заказов (S, low).
- aria-label на иконочные действия в таблице запчастей PartsVehicleDetails (S, low).
- **md-сайдбар (w-16) без tooltip на тач-планшетах** — `title` не работает на touch; добавить CSS-tooltip через `::after`/`aria-label` или сдвинуть брейкпоинт сайдбара на `lg:w-64` раньше (M, medium).

### Навигация
- Переупорядочить мобильный bottom-nav (Заказы в баре, не в шторке) — добавить поле `mobilePriority` в MenuItem либо изменить порядок массивов (S, medium).
- z-конфликты fixed-слоёв (кнопка завершения / bulk-bar / nav-бар) — все S, high/medium.

### Тёмная тема (решение нужно)
- **Двойной механизм** — основной это `.dark{}` с `!important` в index.css, но PartsCreateOrder/PartsSettings/PartsNoPricePage используют `dark:`-префиксы вразнобой. Принять одно из двух: убрать `dark:` отовсюду ИЛИ перейти на `dark:`-утилиты и убрать `!important`-блок (M, low).

## Модули и контекст
Каждый — ценность / эффорт / тариф.

| # | Модуль | Ценность | Эффорт | Тариф |
|---|--------|----------|--------|-------|
| ⭐1 | **Глобальный поиск (Cmd+K)** | ищет по запчастям/авто/заказам/клиентам из одного места; на мобиле снимает прыжки между разделами | M | базовый |
| ⭐2 | **QR-этикетки полок и запчастей** | физический поиск детали на складе — самая частая операция; печать ячейки/детали через `window.print()` | S | базовый |
| ⭐3 | **Завершённая мобильная приёмка авто** | Конвейер со страницы авто + «Сканировать VIN» (BarcodeDetector); ключевой полевой сценарий | S | базовый |
| ⭐4 | **Себестоимость → маржа по позиции** | `purchase_price` уже в форме, но не в типе/аналитике; маржа по категориям и по авто — деньги владельца | M | можно платный |
| ⭐5 | **Уведомления в приложении (Bell + badge)** | сервис `notifications` уже есть; DB-trigger на новый marketplace-заказ, переход в `new`, low-stock; колокол в Layout | M | базовый |
| 6 | **Канбан-доска заказов** | видеть все статусы сразу, drag-n-drop статуса (dnd-kit); на мобиле — список | M | можно платный |
| 7 | **Nova Poshta API** | этап 1: автокомплит города/отделения (Combobox); этап 2: создание ТТН + трекинг в заказе | M | можно платный |
| 8 | **Расширенные массовые операции** | чекбоксы при любом статусе + «изменить место/категорию/удалить» через `.in()`; мутации уже есть | S | базовый |
| 9 | **Мобильный FAB «+Создать»** | Speed Dial (авто/запчасть/заказ), ~50 строк, без зависимостей | S | базовый |
| 10 | **История изменений / аудит-лог** | таблица `parts_activity_log` + триггеры diff; кто/когда менял цену, статус; вкладка «История» | L | платный |

## Производительность и масштаб

### ДО роста (фундамент, делать сейчас)

**1. Пагинация `getPartsInventory` (critical, L).** Сейчас `SELECT *` без `.range()` грузится одним ключом `['parts-inventory', companyId]` сразу на 4 страницах (PartsInventory, PartsNoPricePage, PartsCustomerProfile, PartsVehicleDetails); при 10k строк — 5-15 МБ JSON. Перевести на `getPartsInventory(companyId, {page,pageSize=50,status?,vehicleId?,search?})` с `.range()` + серверными `.eq()/.ilike()`; на UI — `useInfiniteQuery` / «Загрузить ещё». Отдельные лёгкие запросы для PartsNoPricePage (`.is('selling_price', null)`, без JOIN) и PartsCustomerProfile (узкий `.select` доступных).

**2. Индексы (S, чистый SQL, применять вручную в Supabase по конвенции проекта):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_parts_inv_company_status   ON parts_inventory(parts_company_id, status);
CREATE INDEX CONCURRENTLY idx_parts_inv_company_created  ON parts_inventory(parts_company_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_parts_inv_name_trgm        ON parts_inventory USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_parts_inv_partnum_trgm     ON parts_inventory USING gin(part_number gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_parts_orders_company_status ON parts_orders(parts_company_id, status);
CREATE INDEX CONCURRENTLY idx_parts_orders_company_date   ON parts_orders(parts_company_id, order_date DESC);
CREATE INDEX CONCURRENTLY idx_parts_vehicles_company_status ON parts_vehicles(parts_company_id, status);
CREATE INDEX CONCURRENTLY idx_parts_categories_template ON parts_categories(is_template) WHERE is_template = true;
CREATE INDEX CONCURRENTLY idx_parts_categories_company  ON parts_categories(parts_company_id) WHERE is_template = false;
```
GIN-индексы trgm автоматически ускоряют `ilike '%q%'` без изменений кода.

**3. RPC-агрегаты дашборда (M).** Заменить 6 запросов с клиентской агрегацией на один `get_parts_dashboard_stats(p_company_id)` → JSON (`vehicles/inventory/orders/customers` через `count(*) FILTER (...)`, `SECURITY DEFINER STABLE`). Туда же завести onboarding-статус (`get_onboarding_status`) и брать usage-счётчики из этого же RPC, убрав дубли в `useSubscriptionUsage`. `staleTime` статистики — 2-3 мин.

**4. Серверная агрегация клиентов и аналитики (M/L).** `getPartsCustomers` — заменить два запроса (включая выгрузку ВСЕХ заказов) на один `LEFT JOIN ... GROUP BY` / RPC `get_parts_customers_with_stats`; в sell-модалке использовать готовый `getPartsCustomersDropdown`. PartsAnalytics — `get_parts_analytics_stats(company, months)` с `GROUP BY date_trunc('month')` и `topParts LIMIT 5`; кандидат на materialized view с pg_cron-refresh.

**5. Bulk-операции — убрать N+1 (S).** `bulkSellMutation` сейчас 2 цикла с `await` (10 позиций = 20 последовательных запросов). Заменить на bulk-`insert(...).select()` и `update(...).in('id', ids)` либо RPC `complete_bulk_order`.

**6. Connection pooling (S, действие в UI).** Включить Transaction mode (Supabase → Settings → Database → Connection pooling), в проде использовать pooler URL (порт 6543). Проактивно до 50+ одновременных пользователей.

### Реактивно (по метрикам)
- **Виртуализация** списков склада/заказов (`@tanstack/react-virtual`) — нужна, только если пагинацию отложат; иначе в DOM и так 50 элементов.
- **Code-split внутри PartsInventory** (2217 строк) — частично закрывается lazy-модалками из «быстрых побед»; глубже дробить по метрике размера чанка.
- **to_tsvector full-text** вместо trgm — только если `pg_stat_statements` покажет, что GIN-trgm недостаточно.

### KPI (целевые)
- **p95 запроса склада/заказов** < 300 мс при 10k строк (сейчас — линейно растёт, seq-scan).
- **Размер ответа списка склада** < 200 КБ (50 строк) против текущих 5-15 МБ.
- **Число запросов дашборда** ≤ 2 (RPC stats + marketplace-count) против текущих 6+ (и +5 от OnboardingChecklist).

## Этапы

### Этап 1 — срочные UX-фиксы + перф-фундамент (1-2 спринта)
Параллельно две дорожки:
- **Дорожка A (фронт, UX):** все S-фиксы из «Быстрых побед» 🎨 + единая система контейнеров. Независимы друг от друга, можно раздать.
- **Дорожка B (данные, перф):** индексы (сразу, ничего не блокируют) → пагинация `getPartsInventory` → RPC `get_parts_dashboard_stats` + onboarding/usage → bulk-N+1 + pooling.

Индексы и pooling параллелятся с чем угодно. Пагинация — предпосылка для снятия проблемы виртуализации и для серверного поиска.

### Этап 2 — модули + масштаб (после фундамента)
- ТОП-5 модулей: глобальный поиск, QR-этикетки, мобильная приёмка, маржа по позиции, уведомления.
- Масштаб: серверная агрегация клиентов/аналитики, materialized view + pg_cron.
- Параллельно: QR-этикетки и мобильная приёмка (фронт) ⟂ агрегаты клиентов/аналитики (данные). Глобальный поиск требует trgm-индексов из Этапа 1 (уже будут).

### Этап 3 — рост
- Канбан заказов, Nova Poshta (ТТН), история изменений/аудит-лог, мобильный FAB, расширенные массовые операции.
- Аудит-лог (L) запускать отдельно — триггеры на 3 таблицы + UI вкладки. Канбан и Nova Poshta независимы и параллелятся.

## Меню выбора
Отметьте нужное (✅ — рекомендую в первую очередь).

| Пункт | Ось | Эффект | Эффорт |
|------|-----|--------|--------|
| ✅ Паддинги `page-container` на 5 страницах | 🎨 UX | контент не упирается в края на 360px | S |
| ✅ z-index «Завершить заказ» + спейсер | 🎨 UX | кнопка не перекрыта nav-баром | S |
| ✅ Действия в таблице на тач (pointer:coarse) | 🎨 UX | edit/sell/delete доступны без мыши | S |
| Bulk-bar над nav-баром + z-50 | 🎨 UX | видна кнопка массовой продажи | S |
| Кнопка «Назад» → btn-icon | 🎨 UX | тач-таргет 44px | S |
| Footer-кнопки `min-h-[44px]` | 🎨 UX | тач-таргет 44px | S |
| `✕`→`<X/>` + aria-label | 🎨 UX | доступность screen-reader | S |
| Переупорядочить bottom-nav | 🎨 UX | Заказы в баре, не в шторке | S |
| Grid «Управление» 3 cols | 🎨 UX | ровный layout на мобиле | S |
| `shadow-float` → `shadow-lg` | 🎨 UX | тень bulk-bar появляется | S |
| Tooltip md-сайдбара | 🎨 UX | подписи иконок на планшетах | M |
| Единая система контейнеров | 🎨 UX | консистентная ширина/отступы | M |
| overflow-x на графиках Analytics | 🎨 UX | читаемые графики на мобиле | M |
| Решение по тёмной теме | 🎨 UX | один механизм, без конфликтов | M |
| ✅ Индексы (SQL CONCURRENTLY) | ⚡ перф | p95 запросов вниз, без правок кода | S |
| ✅ Пагинация `getPartsInventory` | ⚡ перф | ответ 5-15 МБ → <200 КБ | L |
| ✅ RPC `get_parts_dashboard_stats` | ⚡ перф | 6+ запросов → 1-2 | M |
| Серверный поиск (после пагинации) | ⚡ перф | поиск без выгрузки всего склада | M |
| Агрегация клиентов на БД | ⚡ перф | не тянуть все заказы для total | M |
| RPC/MV аналитики | ⚡ перф | без клиентской агрегации 5k+ строк | L |
| Bulk N+1 → batch/RPC | ⚡ перф | 20 запросов → 2 | S |
| staleTime usage + OnboardingChecklist | ⚡ перф | минус 5-7 запросов на дашборде | S |
| lazy модалки в PartsInventory | ⚡ перф | легче первый чанк | S |
| Connection pooling (Transaction mode) | ⚡ перф | x10 запас по соединениям | S |
| Виртуализация списков | ⚡ перф | плавный скролл (если без пагинации) | M |
| ✅ Глобальный поиск (Cmd+K) | 🧩 модуль | поиск по всему кабинету | M |
| ✅ QR-этикетки полок/запчастей | 🧩 модуль | быстрый физпоиск на складе | S |
| ✅ Конвейер + VIN со страницы авто | 🧩 модуль | завершённая мобильная приёмка | S |
| ✅ Маржа по позиции/категории | 🧩 модуль | владелец видит прибыль | M |
| ✅ Уведомления (Bell + badge) | 🧩 модуль | напоминания о заказах/остатках | M |
| Канбан заказов | 🧩 модуль | все статусы сразу, drag-n-drop | M |
| Nova Poshta (автокомплит/ТТН) | 🧩 модуль | меньше ошибок ввода, трекинг | M |
| Расширенные массовые операции | 🧩 модуль | место/категория/удаление пачкой | S |
| Мобильный FAB «+Создать» | 🧩 модуль | создание в 1 тап | S |
| История изменений / аудит-лог | 🧩 модуль | кто/когда менял, восстановление | L |
| Доступ worker к Складу/Аналитике | 🧩 модуль | сотрудник видит схему полок | S |