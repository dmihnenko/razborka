# Дизайн-аудит и промпт по улучшению — razborka.net (2026-06-25)

Комплексный аудит силами 7 профильных UI/UX-агентов по ВСЕМ экранам кабинета, лендинга, маркета, публичных страниц и админки (~58 экранов) + сквозной срез по типографике/контрасту/доступности (WCAG 2.2) и дизайн-токенам `src/index.css`. Оценка по стандартам интерфейса/читаемости 2026.

Ограничения проекта (соблюдать в правках): светлый дизайн; **компактные элементы (не раздувать)**; без нео-брутализма; бренд — **ink-монохром + индиго `#3538CD`** (БЕЗ синего azure); стиль «Ink & Signal»; русский UI (+uk); mobile-first (360px и десктоп); токены/классы из `index.css`; top-sheet модалки.

---

## Область применения (подсистемы)

**«Ink & Signal» — единственный стиль ЯДРА: разборка-кабинет + админка.** Уточнено пользователем 2026-06-25.
- **«Мои авто»** (MyVehicles/Archive/PublicPersonalVehicleView) — **ОТДЕЛЬНАЯ ПОДСИСТЕМА со своим стилем.** НЕ сводить к Ink & Signal. Находки по ней ниже трактовать как «внутренняя консистентность/читаемость/доступность подсистемы», а НЕ «привести к бренду ядра».
- **Маркет** (`--mk-*`, «Steel & Electric Blue») — тоже **отдельная подсистема** (публичная витрина). Аналогично: чинить внутреннюю консистентность, не сливать с Ink & Signal.
- **Лендинг / ResetPassword / VehicleAccess** (тёмные хардкод) — **приводятся к Ink & Signal** (решение пользователя 2026-06-25): переписать на светлую систему ядра, как Login. Это часть A8.

Поэтому **унификация к Ink & Signal = только ядро (кабинет + админка)**: убрать «радужные» акценты и azure-хвост ТАМ. Подсистемы «Мои авто»/«Маркет» остаются собой.

## Главный вывод

Приложение **расслоилось на 3 «поколения» стиля**, которые сосуществуют (в пределах ЯДРА — кабинета/админки):
1. **Эталон «Ink & Signal»** (монохром + индиго) — Layout, AdminLayout, ContextSwitcher, BusinessLanding, PartsApplication, Login, AdminSettings, PartsCompanies, PartsRoi, PartsWarehouse, PartsCategories, Trash.
2. **Старая azure-схема (синий `#1173D4`)** — MyVehicles, MyVehiclesArchive, частично tailwind.config/spinner/dark-focus.
3. **«Радужные» акценты** (8 цветов плиток, 6 цветов аватаров, цветные иконки-лейблы) — PartsSettings, PartsEmployees, ProfileSettings, AdminPanel/StatCard, формы юзеров.

Бóльшая часть проблем — НЕ внутри одного экрана, а в **рассинхроне между под-системами**. Поэтому максимальная отдача — у системных правок (токены/классы), а не у точечных.

Эталонные экраны как референс паттернов: **BusinessLanding, PartsApplication, Login** (публичный периметр), **AdminSettings, PartsCompanies** (списки/настройки), **PartsRoi** (визуализация данных), **PartsWarehouse** (дисциплина токенов), **Modal.tsx** (top-sheet), **MarketCatalog** (образцовая ARIA-пагинация).

---

## A. Системные улучшения (фикс один раз → эффект на всех экранах) — ПРИОРИТЕТ

### A1. 🔴 Единый источник статус-цветов
Сейчас статус заказа/позиции рисуется **3+ несовместимыми системами**: `badge badge-*` (`index.css:395`), `cab-chip text-*`, и `getPartsOrderStatusColor` (`utils/status.ts:14` → `bg-*-100 text-*-800`). Один статус «Отправлен» выглядит по-разному на 3 экранах; «Сборка»/«Отправлен» местами падают в серый.
**Фикс:** одна функция `statusBadgeClass(status)` в `utils/status.ts` на базе `badge-*` (уже поддержаны тёмной темой), добавить `assembling`/`shipped`; заменить во всех местах (PartsOrders:41, PartsOrderDetails:35, PartsCustomerProfile:446, PartsInventory:42, PartsInventoryItemPage:28, PartsVehicleDetails:41). Унифицировать `cab-chip` vs `chip` (Shipments:125, MarketOrders:287, Roi:124).

### A2. 🔴 `--primary` = чернила ломает семантику «активный/выбран/ссылка»
`border-primary`/`ring-primary`/`hover:text-primary`/`text-primary` дают ЧЁРНЫЙ там, где по смыслу нужен индиго-сигнал (выбранный тариф, активный фото-сервис, ссылки). `--cab-signal #3538CD` существует, но применяется непоследовательно.
**Фикс:** для «активный/выбран/ссылка/промо» использовать `--cab-signal` (`border-[var(--cab-signal)] bg-[var(--cab-signal-weak)]`); `--primary`(ink) оставить для текста/нейтральных бордеров. Точки: Subscription:291/295, PartsSettings:483, Employees:232/300.

### A3. 🔴 Убрать «радужные» акценты → ink-монохром + один индиго
8 цветов иконок-плиток (PartsSettings:305-339), 6 цветов аватаров (Employees:22-29, Customers:29, CustomerProfile:46), цветные иконки-лейблы (ProfileSettings:188-219, PublicPartsItemView:77-89), пёстрые KPI-плитки (StatCard COLOR, AdminPanel colorMap, Subscriptions KPI hex).
**Фикс:** плитки/иконки → `bg-[var(--cab-surface-2)]` + `text-[var(--cab-ink-2)]`, индиго точечно (1–2 акцента); аватары — монохром/инициалы на surface-2; «положительные» метрики могут оставаться emerald.

### A4. 🔴 Удалить синий azure-хвост В ЯДРЕ (бренд кабинета БЕЗ синего)
`tailwind.config.js:78,88-93` (`brand.*`/`sidebar.active`=`#1173D4`, `glow-blue`), `.spinner` (`index.css:1055`), dark focus (`:901`) — старый azure `#1173D4`; мёртвый `--brand:37 99% 235%` (невалидный HSL).
**Фикс:** свести бренд ЯДРА к `#3538CD`/`--brand-*`; удалить мёртвый токен.
**NB:** «Мои авто» — отдельная подсистема со своим стилём (синие карточки там ИНТЕНЦИОНАЛЬНЫ), её НЕ трогаем в рамках унификации ядра.

### A5. 🟠 Контраст вторичного текста ниже WCAG AA (системно)
`text-gray-400 #94A3B8` ≈ **2.6:1** и `--cab-ink-3 #8B909A` ≈ **3.1:1** массово применяются к СОДЕРЖАТЕЛЬНОМУ тексту (артикулы, OEM, года, даты, лейблы сумм, плейсхолдеры, хинты настроек). Норма — 4.5:1.
**Фикс:** ввести токен `--text-muted` (≥4.5:1 на белом И на surface-2, ориентир `#6B7280`); глобально `text-gray-400 → text-gray-500`/`--cab-ink-2` для контента; плейсхолдеры `.form-input`/`.modal-input` (`index.css:426,1120`) — на новый токен. Точки: PartsInventory:803/967/1024/1054, Warehouse:387/442, Shipments:169, Roi:221, ActivityLog, Orders:527, footers `text-gray-300` (PublicPartsItemView:598, LocationView:248).

### A6. 🟠 Единая типографическая шкала
Нет модульной шкалы: смесь Tailwind `text-xs/sm/base`, rem-литералов (`.72/.8/.95rem`) и px (`11px`, `10px`, инлайн `fontSize:'11px'`). `.kicker 11px`/`.cab-group-label 10px` — НЕ rem, не масштабируются от `--app-font-size`. Содержательный текст часто <12px.
**Фикс:** ввести `--fs-xs…--fs-2xl` в rem (от `--app-font-size`); заменить px/rem-литералы; минимум содержательного текста ~12.5–13px; `body{letter-spacing:-0.01em}` оставить только заголовкам, мелкому body вернуть 0.

### A7. 🟠 Тёмная тема не покрывает кабинет
`--cab-*` НЕ переопределяются в `.dark` → весь кабинет остаётся светлым островом в тёмной теме (белые `cab-card`/сайдбар на тёмном фоне).
**Фикс:** добавить блок `.dark { --cab-bg/-surface/-surface-2/-border/-ink/-ink-2/-ink-3: … }` по образцу `.dark .market` (`index.css:1019`). Инлайн-`style` в кабинете (Layout:275/283, Dashboard:267/366) тема не получит — переводить на классы/токены.

### A8. 🟠 Тёмные/хардкод-экраны публичного периметра
LandingPage (`#080C14`), ResetPassword (`#0D1117` + локальный `<style>` с `Bebas Neue`/`DM Sans`), VehicleAccessPage (`#0D1117`) — захардкожены в тёмную палитру с провалами контраста (футер лендинга `#1E293B` на `#080C14` ≈ **1.4:1**; описания карточек `#475569` ≈ 2.6:1; trust-подписи VehicleAccess `#374151` ≈ 2.2:1). Пользователь прыгает тёмный↔светлый внутри одного флоу.
**Фикс:** переписать на светлую систему (как Login): `--cab-bg`, `.cab-card`, `.form-*`, `.cab-btn-*`. Удалить локальный `<style>` и кастомные шрифты ResetPassword. Это закрывает разом контраст+хардкод+разрыв бренда.

### A9. 🟠 Дубли систем → консолидировать
- **Модалки:** компонент `Modal.tsx` ↔ CSS-классы `.modal-*` (`index.css:1090`) — почти идентичны, два источника; часть модалок собраны вручную (CustomerProfile:543, Subscriptions 3 шт, Roles, PartsCompanies:502) НЕ top-sheet. → всё на `<Modal>`/`modal-*`.
- **Segmented-toggle ×3** (Employees:158, Subscription:220, ContextSwitcher) + ручные таб-свитчеры ×3 в админке (AccessRequests:81, CarModels:171, Support:284) → один `<SegmentedToggle>`.
- Кнопки `btn-*` (градиент) ↔ `cab-btn-*` (плоские); формы `form-input` ↔ `modal-input` — выбрать один путь на контекст.

### A10. 🟡 Деструктив, тач-таргеты, состояния
- **Деструктив замаскирован** под secondary/ghost (нет `cab-btn-danger`): OrderDetails:379, MarketOrders:179, Customers:366, MarketOrders/InventoryItem «Удалить» = ghost. → `cab-btn-danger` или icon-only серый, красный на hover.
- **Тач-таргеты <44px:** степперы кол-ва (CustomerProfile:776/828 — 28-32px, фон `bg-gray-900` хардкод), icon-кнопки `w-8 h-8` (Subscriptions:347), `p-2.5`/`h-8` сегменты, ContextSwitcher `h-8`. → ≥44px (или гарантировать `<button>`, чтобы сработало правило `pointer:coarse`).
- **Нет skeleton:** Dashboard, Analytics, Roi, Orders board, Roles — голый Spinner/нули при загрузке. → skeleton-плейсхолдеры.
- **Подтверждение деструктива:** деактивация/приостановка компании без `useConfirm` (PartsCompanies:380, CompanyDetail:98). → добавить.

### A11. 🟡 i18n-пробелы
Полный хардкод RU (выпадают из ru/uk): PartsSubscriptionPage, ProfileSettings, MyVehicles/Archive, навигация AdminLayout, статус-словари (PartsVehicleDetails:34, PartsVehicles:122 — модульный `i18n.t`, не реактивный). → namespace i18n + реактивный `t()` внутри компонентов.

### A12. 🟡 Графики/значения только по hover (недоступны на тач)
Analytics бар-чарт: значение в `opacity-0 group-hover` (`:188`) — на мобиле не прочитать; Roi прогресс-бар без легенды; `title=`-тултипы. → значения всегда видимы (или tap-tooltip), мини-легенда, лёгкие grid-линии.

### A13. 🟡 Мобильные sticky-CTA и хардкод в каркасе
- Нет sticky «В корзину»/итога на мобиле: MarketProductPage, MarketCart. → нижняя sticky-плашка цена+CTA.
- Хардкод hex/px в каркасе (правило проекта запрещает): Layout `text-[#16181D]`/`bg-[#16181D]`/`fontSize:'11px'` (:436/502/440), `min-h-dvh bg-[#FAFAFA]` (UserEdit:176). → `var(--cab-ink)` / классы.

---

## B. По срезам (ключевое; полные находки — в отчётах агентов)

### Лендинг/вход
- LandingPage/ResetPassword/VehicleAccess → светлая система (A8). Цветовой зоопарк иконок преимуществ → монохром-индиго.
- Login: добавить инлайн-`.form-error`+`aria-invalid` (паттерн готов в PartsApplication, сейчас только тосты); «Забыли пароль?» 12px→14px, тач ≥36px.
- PartsApplication: обернуть в `<form onSubmit>` (Enter сабмитит), disabled-визуал кнопки «+».

### Маркет/публичные
- Портировать 4 `Public*` страницы на `mk-*`-токены/бейджи (purple/blue бейджи → монохром+accent). **PublicPersonalVehicleView** — наибольшая переработка: градиентные карточки+двойные бордеры, раздутые хардкод-кнопки, центрированные (не top-sheet) модалки, `alert()` → toast/ConfirmDialog.
- MarketProductPage: мобильный sticky-CTA; убрать всегда-истинный бейдж «Оригинал» (:155); цена-лейбл 10px→11px.
- Каталог: ряд активных фильтров-чипов с «×» (видимость фильтрации на мобиле). i18n toast в MarketProductCard:58. Согласовать число скелетон-карточек с page size.
- `******` как H1 в PublicPartsCustomerView:185 → осмысленный заголовок.

### Кабинет (склад/авто/заказы)
- A1 (статусы), A5 (контраст), A10 (деструктив/тач/skeleton) — основное.
- Сорт-стрелки `↑/↓` юникод → lucide `ArrowUp/Down` (PartsInventory:861); `strokeWidth={1.5}` на иконки (PartsCategories:289).
- Локаль чисел: `toLocaleString('ru-RU')` ↔ `intlLocale()` вперемешку → везде `intlLocale()`.
- PartsWarehouse: touch-fallback к HTML5-drag (стрелки «выше/ниже/в родителя») — иначе структура не правится с телефона (нарушение mobile-first).
- PartsOrders: убрать дублирование фильтров (stat-плитки ↔ чипы статуса делают одно и то же).

### Настройки/команда/каркас
- A3 (радуга), A2 (signal), A9 (модалки/toggle), A11 (i18n).
- Layout: десктопные плавающие FAB (поиск/уведомления) перекрывают правый-нижний угол (там пагинация/CTA) → перенести в топбар.

### «Мои авто» — ОТДЕЛЬНАЯ ПОДСИСТЕМА (не сводить к Ink & Signal)
Свой стиль интенционален. Внутри подсистемы стоит лишь подтянуть базу: единый каркас/шапка (`MyVehiclesArchive` без неё), скелетоны загрузки (Archive грузит текстом, активный список — shimmer: рассинхрон ВНУТРИ фичи), читаемость (`text-xs sm:text-xs` опечатка, `renderClassicCard(any)` типизация), убрать мёртвый код share/delete. Бренд/цвет НЕ менять.
- ProfileSettings/PartsSettings дублируют редактирование контактов разборки → оставить в одном месте.

### Админка
- Roles.tsx — полностью вне системы (+сломанный JSX, нет skeleton/empty) — высший приоритет рескина.
- UserCreate (purple) ↔ UserEdit (indigo) — две формы одного объекта по-разному → один паттерн `form-*`+индиго, аватар `--brand-gradient`.
- Subscriptions: 3 модалки → top-sheet; KPI → `stat-card`; статусы → `badge-*`.
- Вынести запросы PartsCompanies из компонента в `services/*` (конвенция).
- Убрать `👋` из AdminPanel, `dark:`-классы из AdminAnalytics; ведущая серия графиков → `--brand-600`.

---

## C. Порядок исполнения (волнами)

**Волна 0 — токен-фундамент (1 PR, максимальная отдача):**
A4 (свести бренд к индиго, удалить azure/мёртвый токен) → A5 (`--text-muted`, gray-400→gray-500) → A6 (шкала `--fs-*`) → A1 (единый `statusBadgeClass`) → A2 (signal для active/link). Всё в `index.css`/`tailwind.config`/`utils/status.ts` + точечные замены. Не меняет разметку, мгновенно поднимает консистентность и читаемость везде.

**Волна 1 — общие компоненты:** `<SegmentedToggle>`, консолидация модалок на `<Modal>`, `cab-btn-danger` на деструктивы, skeleton-хелперы. (A9, A10)

**Волна 2 — рескин «отстающих» экранов:** MyVehicles/Archive, Roles, UserCreate/UserEdit, Subscriptions-модалки, 4 `Public*` (особенно PersonalVehicleView), тёмные Landing/Reset/VehicleAccess. (A3, A8)

**Волна 3 — UX-доводка:** мобильные sticky-CTA, активные фильтры-чипы, графики без hover, touch-fallback drag, i18n-пробелы, тёмная тема `--cab-*`. (A7, A11, A12, A13)

**Быстрые победы (можно сразу, низкий риск):**
1. `text-gray-400 → text-gray-500` для контента (глобальный проход) — снимает большинство AA-замечаний.
2. Footer `text-gray-300 → text-gray-400`/`mk-meta` — фикс провала контраста (3 файла).
3. `cab-btn-danger` на деструктивы (чистая замена класса).
4. Убрать всегда-истинный бейдж «Оригинал» (MarketProductPage:155); `👋` из AdminPanel; `dark:`-классы из AdminAnalytics.
5. `strokeWidth={1.5}` на иконки PartsCategories; сорт-стрелки → lucide.
6. Удалить мёртвый код (MyVehicles share/delete; `text-xs sm:text-xs` опечатка; store-роли в getRoleBadgeClass).
7. `alert()` → toast в PublicPersonalVehicleView (5 мест; sonner/ConfirmDialog уже доступны).

---

## D. Что хорошо (сохранить как стандарт)
Фундамент доступности заложен: глобальный `@media (pointer:coarse)` 44px, `prefers-reduced-motion`, `focus-visible` с halo, iOS-zoom guard (`input{font-size:16px}` на мобиле), `useReducedMotion` во Framer. Текст на индиго `#3538CD` — белый ≈6.9:1 (отлично). Богатый токен-слой `--cab-*`/`--mk-*`. Эталонные экраны (см. выше) — образец, к которому подтягивать остальные. **Нео-брутализма, раздутых элементов и тёмных тем в кабинете не найдено — направление выдержано; основная работа — снять визуальный шум и свести разъехавшиеся токены в один источник.**
