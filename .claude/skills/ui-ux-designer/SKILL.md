---
name: ui-ux-designer
description: Дизайн и редизайн экранов в этом проекте по существующей дизайн-системе (Tailwind + токены из src/index.css, mobile-first, русский UI). Используй, когда нужно создать или переработать UI — страницу, модалку, карточку, список, форму — так, чтобы результат был отполированным и консистентным с остальным приложением.
---

# UI/UX дизайнер (этот проект)

Цель — экраны, неотличимые по стилю от остального приложения. Перед версткой **открой 1–2 соседних экрана** (`Dashboard.tsx`, `AppointmentsBoard.tsx`, `AppointmentDetails.tsx`) и повтори их паттерны. Не изобретай новый визуальный язык.

## Дизайн-система (`src/index.css`, `@layer components`)
Используй готовые классы вместо сырого Tailwind, где они есть:
- **Кнопки:** `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `btn-success`; модификаторы `btn-sm`/`btn-lg`/`btn-touch`; иконочные `btn-icon`, `btn-icon-sm`.
- **Карточки:** `card` (и алиас `card-mobile`), `stat-card` (плитки дашборда).
- **Бейджи/статусы:** `badge` + `badge-blue|green|red|yellow|orange|purple|gray`; `status-badge`, `status-dot`.
- **Формы:** `form-label`, `form-input`, `form-select`, `form-error`.
- **Типографика:** `heading-1..3`, `page-title`, `page-subtitle`, `text-mobile-sm|base|lg`.
- **Прочее:** `empty-state*`, `alert alert-info|success|warning|danger`, `avatar-sm|md|lg`, `section-divider`, `animate-slide-up`, `animate-fade-in`.

## Ширина и контейнер
- Контент страниц заполняет родителя (`<Layout>` уже центрирует на `max-w-[1440px]` с отступами). **Не** добавляй внутренних `max-w-*xl mx-auto` кэпов на основные data-страницы — это делает их у́же дашборда (стандарт ширины = Dashboard).
- Узкие формы/настройки — исключение: для них узкая ширина оправдана читабельностью.

## Модалки — bottom-sheet паттерн (обязательно)
Снизу на мобиле, по центру на десктопе. Либо классы `modal-overlay` / `modal-sheet` / `modal-handle` / `modal-header` / `modal-body` / `modal-footer` / `modal-input` / `modal-btn-cancel|primary`, либо тот же паттерн вручную:
`fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4` + лист `w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl`. Кнопки футера учитывают `env(safe-area-inset-bottom)`.

## Правила стиля
- **Mobile-first:** сначала мобайл, затем `sm:`/`lg:`/`xl:`. Тач-таргеты ≥44px (уже в base).
- **Цвета:** primary = `#2563EB` (`bg-primary`/`text-primary`). Статусы по палитре: scheduled `#7C3AED`, in_progress `#D97706`, completed/ready `#16A34A`, archived серый, cancelled/удаление `#DC2626`. Совпадай с `STATUS_CFG` на доске.
- **Иконки:** `lucide-react`, глобально `stroke-width:1.5`. Размеры `w-3.5/w-4/w-5`.
- **Текст — русский.** Деньги — `₴`, `toLocaleString('ru-RU')`. Скругления крупные (`rounded-xl`/`rounded-2xl`), тени мягкие.
- **Тёмная тема:** не хардкодь цвета, где есть классы Tailwind — `.dark` переопределяет `bg-white`, `text-gray-*`, `border-gray-*` и токены автоматически. Инлайн `style={{color:'#...'}}` тему не получит — используй с осторожностью.
- **Состояния:** всегда продумай loading (`Spinner`), пусто (`empty-state`), ошибку. Подтверждения деструктивных/статусных действий — модалкой, не `window.confirm`.

## Чек перед сдачей
- Совпадает ли по плотности/радиусам/цветам с соседним экраном?
- Ок на 360px шириной и на десктопе?
- Нет ли узкого `max-w` кэпа на основной странице?
- `npx vite build` проходит.
