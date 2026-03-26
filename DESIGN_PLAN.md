# DESIGN_PLAN.md — Новое оформление TSP-V2

> **Backup перед стартом:** `design-backup/` — полная копия всех файлов дизайна.  
> Для восстановления — инструкция в конце документа.

---

## Концепция

**Automotive Control System** — профессиональный интерфейс для механиков и владельцев СТО.  
Использует тёмный sidebar + светлый контент, уверенная типографика, чёткие статусы.

**Направление:**
- Тёмный боковой бар (`#0C1220`) с синим акцентом  
- Белый/светло-серый контент (`#F8FAFC`)  
- Шрифт: **DM Sans** (чёткий, технический, не банальный)  
- Акцент: `#2563EB` (синий) + `#10B981` (зелёный для успеха)  
- Border radius: консистентный `8px` по всему проекту  
- Состояния: явные hover, focus-ring, active  

---

## Файлы для изменения

| Файл | Что меняем |
|------|-----------|
| `src/index.css` | CSS-переменные, базовая типографика, utility-классы |
| `tailwind.config.js` | Палитра цветов, шрифт, borderRadius |
| `index.html` | Подключение Google Font (DM Sans) |
| `src/components/Layout.tsx` | Sidebar + mobile nav — структура и стили |
| `src/components/AdminLayout.tsx` | Admin sidebar — структура и стили |
| `src/components/LayoutSkeleton.tsx` | Skeleton — цвета под новый дизайн |

---

## Пошаговый план реализации

### ШАГ 1 — Шрифт и CSS-переменные (`index.html` + `tailwind.config.js` + `src/index.css`)

**1.1. `index.html`** — добавить Google Font:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

**1.2. `tailwind.config.js`** — расширить тему:
```js
theme: {
  extend: {
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'sans-serif'],
    },
    colors: {
      // Sidebar
      sidebar: '#0C1220',
      'sidebar-hover': '#1A2744',
      'sidebar-active': '#2563EB',
      'sidebar-border': 'rgba(255,255,255,0.06)',
      // Brand
      brand: '#2563EB',
      'brand-hover': '#1D4ED8',
      // Existing HSL tokens remain
      border: "hsl(var(--border))",
      // ...
    },
    borderRadius: {
      DEFAULT: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '20px',
    },
  }
}
```

**1.3. `src/index.css`** — обновить CSS-переменные и utility-классы:
- Заменить `:root { ... }` — новая палитра  
- Обновить `.dark { ... }` — более тёмная и глубокая палитра  
- Обновить `.card-mobile` — новый border-radius и тень  
- Обновить `.btn-touch` — новые стили кнопок  
- Добавить новые utility-классы: `.sidebar-link`, `.page-header`, `.stat-card`  

**Проверка шага 1:**
```bash
npm run build:check   # должен пройти без ошибок
```

---

### ШАГ 2 — Layout: Desktop Sidebar (`src/components/Layout.tsx`)

Цель: тёмный sidebar с группированным меню и user-info внизу.

**Структура:**
```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (w-16 md → w-64 lg)    │  Content area             │
│  bg: #0C1220                    │  bg: #F8FAFC              │
│  ┌────────────────────────────┐ │                           │
│  │ Logo + App name            │ │  <Breadcrumbs />          │
│  ├────────────────────────────┤ │  <Outlet />               │
│  │ Nav group: Основное        │ │                           │
│  │   • Dashboard              │ │                           │
│  │   • Клиенты                │ │                           │
│  │   • Автомобили             │ │                           │
│  ├────────────────────────────┤ │                           │
│  │ Nav group: Работа          │ │                           │
│  │   • Записи                 │ │                           │
│  │   • Заказ-наряды           │ │                           │
│  ├────────────────────────────┤ │                           │
│  │ (flex-1 spacer)            │ │                           │
│  ├────────────────────────────┤ │                           │
│  │ User info + Logout         │ │                           │
│  └────────────────────────────┘ │                           │
└─────────────────────────────────────────────────────────────┘
```

**Стили sidebar ссылок:**
- Обычный: `text-slate-400 hover:text-white hover:bg-white/5 transition-colors`
- Активный: `bg-blue-600 text-white shadow-sm`
- Иконка: 16px, flex-shrink-0

**Изменения в коде:**
1. Sidebar wrapper: `bg-[#0C1220]` (то же, что было, стиль консистентный)  
2. Логотип: обновить шрифт и размер  
3. Навигационные ссылки: добавить группировку (если `navigation` из `getMenuForRoles` поддерживает группы) или добавить визуальные разделители  
4. User block внизу: аватар-инициалы + имя + кнопка выхода  

**Проверка шага 2:**
- Визуально: sidebar отображается корректно на md и lg  
- Функционально: переходы работают, active-state правильный  

---

### ШАГ 3 — Layout: Mobile Navigation (`src/components/Layout.tsx`)

**Структура:**
```
┌────────────────────────────────────────────────────┐
│  Mobile header (fixed top)                         │
│  bg: #0C1220                                       │
│  [Logo] [Page title]              [User] [Logout]  │
├────────────────────────────────────────────────────┤
│  Horizontal scrollable pills                       │
│  [• Главная] [• Клиенты] [• Авто] [• Записи] ...  │
└────────────────────────────────────────────────────┘
```

**Изменения:**
1. Фиксированный header вверху: `sticky top-0 z-40`
2. Pills: более чёткие, с иконкой, активный — синий фон
3. Отступ контента: `pt-[96px]` чтобы не прятался под header

**Проверка шага 3:**
- Проверить на 375px (iPhone SE)  
- Проверить скролл pills при большом меню  

---

### ШАГ 4 — AdminLayout (`src/components/AdminLayout.tsx`)

Аналогично Layout но с фиолетовым акцентом для admin-зоны:
- Sidebar: то же `#0C1220`, активный элемент: `bg-purple-600`
- Брендинг: Shield иконка + "Админ-панель"
- Группировка уже есть (`adminNavigationGroups`) — оставить, обновить стили

**Проверка шага 4:**
- `/admin` доступен для admin-роли  
- Переключение секций работает  

---

### ШАГ 5 — LayoutSkeleton (`src/components/LayoutSkeleton.tsx`)

Обновить цвета skeleton-блоков под новую палитру:
- Sidebar skeleton: `bg-[#0C1220]`, pulse-blocks: `bg-[#1A2744]`
- Content skeleton: `bg-[#F8FAFC]`, pulse-blocks: `bg-gray-100`

---

### ШАГ 6 — Финальная полировка CSS (`src/index.css`)

После того как Layout работает — финальная доводка:
1. Обновить `.card-mobile` — добавить `hover:shadow-md transition-shadow`
2. Добавить `.page-container` — стандартный контейнер страниц с max-width и padding
3. Обновить `.status-badge` — более чёткие цвета для каждого статуса
4. Добавить плавный `transition: colors` на все интерактивные элементы

---

### ШАГ 7 — QA и тесты

```bash
npx tsc --noEmit          # 0 TypeScript ошибок
npm run lint              # 0 предупреждений
npm test                  # все тесты зелёные
npm run build:check       # сборка проходит
```

Визуальная проверка:
- [ ] Desktop 1440px: sidebar + контент
- [ ] Tablet 768px: sidebar нормально сворачивается
- [ ] Mobile 375px: горизонтальные pills, нет overflow
- [ ] Dark mode: все цвета правильно меняются
- [ ] Navigation: все переходы работают
- [ ] Logout: работает из обоих layouts  

---

### ШАГ 8 — Commit

```bash
git add -A
git commit -m "design: new design system — DM Sans, refined sidebar, updated layout"
git push origin master
```

---

## Порядок выполнения шагов

```
ШАГ 1 → ШАГ 2 → ШАГ 3 → ШАГ 4 → ШАГ 5 → ШАГ 6 → ШАГ 7 → ШАГ 8
```

Каждый шаг независим кроме ШАГ 2-3 (они оба в `Layout.tsx`).
После ШАГ 1 можно проверить что шрифт применился.
После ШАГ 2-3 можно проверить весь Layout визуально.

---

## Восстановление из бекапа

Если что-то пошло не так:

```powershell
# Из папки проекта
Copy-Item "design-backup/src/index.css" "src/index.css" -Force
Copy-Item "design-backup/tailwind.config.js" "tailwind.config.js" -Force
Copy-Item "design-backup/postcss.config.js" "postcss.config.js" -Force
Copy-Item "design-backup/index.html" "index.html" -Force
Copy-Item "design-backup/src/components/Layout.tsx" "src/components/Layout.tsx" -Force
Copy-Item "design-backup/src/components/AdminLayout.tsx" "src/components/AdminLayout.tsx" -Force
Copy-Item "design-backup/src/components/LayoutSkeleton.tsx" "src/components/LayoutSkeleton.tsx" -Force
```

Или через git (если изменения не закоммичены):
```bash
git checkout -- src/index.css tailwind.config.js index.html src/components/Layout.tsx src/components/AdminLayout.tsx src/components/LayoutSkeleton.tsx
```

Или полный сброс к последнему коммиту:
```bash
git reset --hard HEAD
```

---

## Бекап файлов (что сохранено в `design-backup/`)

```
design-backup/
  index.html                      ← FOUC script
  tailwind.config.js              ← Tailwind конфиг
  postcss.config.js               ← PostCSS конфиг
  src/
    index.css                     ← Все CSS переменные + .dark блок
    components/
      Layout.tsx                  ← Главный layout СТО
      AdminLayout.tsx             ← Layout панели администратора
      LayoutSkeleton.tsx          ← Skeleton загрузки
```
