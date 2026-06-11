# TSP — CRM для СТО и авторазборок

React 18 + TypeScript + Vite · TanStack Query · Supabase (Postgres + Auth + Edge Functions + RLS) · Tailwind · PWA · деплой на Netlify по пушу в `master`. UI на русском, mobile-first. Мульти-тенант: данные разделены по `sto_company_id` / `parts_company_id`; роли — `admin`, `sto_owner`, `sto_worker`, `parts_owner`, `parts_worker`, `user`.

## Скилы — использовать автоматически

В `.claude/skills/` лежат скилы, адаптированные под этот стек и конвенции репозитория. **Перед каждой задачей сопоставь её с картой ниже и применяй подходящий скил автоматически** — без явного вызова пользователем. Для крупной/неоднозначной работы сначала `tech-lead`, затем профильные скилы.

| Задача | Скил |
|--------|------|
| UI/редизайн экранов, форм, карточек (визуал) | `ui-ux-designer` |
| Фронтенд-инженерия: компоненты, react-query, TS-паттерны | `frontend-designer` |
| Сквозная фича (БД → UI) | `fullstack-feature` |
| Слой данных: миграции, RLS, запросы, react-query | `supabase-data` |
| Планирование крупной/неоднозначной работы (перед стартом) | `tech-lead` |
| Рефакторинг без смены поведения | `refactor` |
| Производительность: бандл, запросы, рендер | `perf` |
| Тесты: Vitest (unit) / Playwright (e2e) | `qa-tester` |
| Релиз/деплой/версия | `release` |
| Пайплайны/Netlify/заголовки/CI | `ci-cd` |
| Аудит безопасности: RLS, auth, Edge Functions, секреты | `security-auditor` |
| Доступность UI: контраст, ARIA, фокус, клавиатура | `accessibility` |

## Команды

- `npm run dev` — дев-сервер
- `npm run build` — сборка · `npm run build:check` — `tsc && vite build` (строже, для проверки перед пушем)
- `npm run lint` — eslint (`--max-warnings 0`)
- `npm test` — Vitest · `npm run e2e` — Playwright
- `npm run deploy` — ручной прод-деплой на Netlify (обычно деплоит сам Netlify по пушу в `master`)

## Конвенции (кратко)

- Бизнес-запросы — через `src/services/*`, типы — из `src/types/*`, не дёргать `supabase` из компонентов напрямую.
- Серверное состояние — только react-query; в `onSuccess` мутаций инвалидировать ВСЕ затронутые ключи.
- UI-классы/токены — из `src/index.css` (`btn-*`, `card`, `badge-*`, `form-*`, модалки `modal-*`); primary `#2563EB`; иконки `lucide-react`.
- Edge Functions с `SERVICE_ROLE_KEY` ОБЯЗАНЫ проверять права вызывающего (паттерн в `supabase/functions/create-user`).
- Перед пушем: `build:check` + `lint` + `test` зелёные.

> Подробности по каждой теме — в соответствующем `SKILL.md`. Следуй чек-листам в конце скилов.
