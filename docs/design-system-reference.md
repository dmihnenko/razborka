# Дизайн-система — референс для редизайна (источник: AutoCRM UI-kit)

Цель: привести интерфейс разборки и админа к этому UI-kit, **сохранив нашу палитру**
(«Steel & Electric Blue»). Источник конвенций — личный кабинет AutoCRM (тот же стек:
React18+Vite+Tailwind+shadcn HSL-токены, Manrope). Переносим структуру/типографику/
радиусы/тени/шелл/паттерны списков; цвета — НАШИ.

## Цветовое решение (наше vs их)
- **Нейтраль**: их тёплая `stone` → у нас **slate/gray** (наш «Steel», текущие HSL-токены оставляем).
- **Primary**: их blue-700 → у нас **`--brand-600` = #2563EB** (наш бренд-рамп `--brand-50…800`).
- **Sidebar (тёмная поверхность)**: navy `#0E1C3D`/`#0A1530` — оставляем navy для сайдбара/CTA
  (он синий, вписывается в Electric Blue). Активный пункт — наш primary `#2563EB`.
- Статусы: success green, danger red, warning amber, accent violet — как у нас.

## Токены (значения берём как у AutoCRM)
- **Радиусы (переопределить в tailwind)**: sm 4 · DEFAULT/md 8 · lg 10 · xl 14 · 2xl 18 · full.
  Контейнеры → `rounded-xl`(14); плашки-иконки → `rounded-lg`(10); кнопки/строки → `rounded-md`(8); бейджи → full.
- **Тени**: `card` `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)` · `card-hover`
  `0 4px 12px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)` · `dialog` `0 20px 60px rgba(0,0,0,.15)` ·
  модалка `0 -4px 32px rgba(0,0,0,.12)`. **Философия: границы (1px) вместо теней**, тени мягкие.
- **Типографика**: body letter-spacing -0.01em; h1 text-2xl/sm:3xl·700·-0.03em; h2 xl/2xl·700·-0.025em;
  h3 lg/xl·600·-0.02em; **числа/деньги — `tabular-nums`**; kicker — **IBM Plex Mono** 11px·500·uppercase·tracking-wider.
- **Шрифты**: `--font-sans` = Manrope; **`--font-mono` = IBM Plex Mono** (цифры/кикеры). Подключить Plex Mono.
- **Root font-size (fluid)**: `html { font-size: clamp(1rem, 0.875rem + 0.26vw, 1.125rem); }` (16→18px к ~1536px) —
  заменяет наш фикс. `--app-font-size`.
- **Брейкпоинты**: дефолт Tailwind (sm640/md768/lg1024/xl1280/2xl1536).
- **Контейнеры**: рабочий `max-w-[1440px]` (xl:1600 · 2xl:1760); контентный max-w-6xl; формы max-w-3xl.
- **Z-index**: контент 0 · sticky-шапки z-20 · сайдбар/оверлеи z-30 · фикс. низ z-40 · модалки z-50.
- **Ориентация/тач**: `@media (pointer:coarse)` кнопки/ссылки/чекбоксы min 44×44;
  `@media (max-width:768px)` input/select font-size:16px (анти-zoom iOS); safe-area pb на фикс-низах;
  тонкий скроллбар 5px только `@media (pointer:fine)`.

## Компоненты (@layer components — значения AutoCRM, цвета наши)
Кнопки `.btn` + варианты (primary/secondary/danger/success/ghost; sm/lg/touch; icon/icon-sm) —
`rounded-md`, min-h 38/44, active:scale .97. Карточки `.card` (border-1 + shadow-card, hover card-hover),
`.grid-hairline`/`.panel-divided` (волосяные 1px разделители), `.stat-card`. Бейджи `.badge-*` (bg-50/text-700/border-100, full).
Таблицы `.table-header-cell`/`.table-cell`/`.table-row`. Формы `.form-label`/`.form-input`/`.form-select`/`.form-error`.
Шапка `.page-header`/`.page-title`/`.page-subtitle`. Алерты `.alert-*`. Аватары `.avatar-*`. Пусто `.empty-state*`.
Kicker `.kicker`, `.icon-tile`/`.icon-tile-sm` (плашка-иконка primary), `.surface-navy`.
Модалка `.modal-overlay`/`.modal-sheet`(rounded-t-3xl/sm:2xl)/`.modal-handle`/`.modal-header`/`.modal-body`/`.modal-footer`.

## Шелл (Layout) — адаптив
Десктоп: слева **navy-сайдбар** `md:w-16`(только иконки) → `lg:w-64`(с подписями); сверху topbar (h-14, действия справа).
Мобайл (<md): сайдбар скрыт; сверху компактная шапка (h-52); снизу **фикс. нижнее меню** (3 основных таба + «Меню»-шторка сеткой 3 кол.).
Контент в скроллируемой колонке, `max-w-[1440px]`(→1760 2xl), адаптивные паддинги `px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6`,
под фикс-низ — спейсер + safe-area. Активный пункт — primary.

## Паттерн списков (везде)
Две раскладки из одного источника: **desktop — `<table>`** (`.table-*`), **mobile — плоские 2-строчные карточки**
(`rounded-lg border shadow-sm`, подпись:значение в строку через `·`, truncate/min-w-0).

## Деталь
Sticky-шапка (z-30) с back + title + действия; «hero»-карточка `rounded-2xl border` с блоками
подпись/значение, разделённые `sm:divide-x`.

## Стайл-гайд (1 фраза)
Плотный деловой mobile-first: границы вместо теней, умеренные скругления, лёгкий отрицательный трекинг,
tabular-nums на числах, быстрые сдержанные переходы (150ms, active:scale .97; модалки slide-up/​pop-in),
один акцент-primary (наш синий), тёмные поверхности — navy, статусы — мягкие пары bg-50/text-700/border-100.

> Полный исходник kit (tailwind.config, index.css, Layout.tsx, Modal.tsx, типовые экраны) — в истории
> переписки с пользователем от 2026-06-13. Применяем поэтапно: Волна 1 — токены+шелл, далее экраны.
