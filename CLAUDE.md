# TSP — CRM для СТО и авторазборок

React 18 + TypeScript + Vite · TanStack Query · Supabase (Postgres + Auth + Edge Functions + RLS) · Tailwind · PWA · деплой на Cloudflare (Workers + Static Assets, `wrangler.jsonc` + `worker/index.js`; заголовки в `public/_headers`) по пушу в `master`. UI на русском, mobile-first. Мульти-тенант: данные разделены по `sto_company_id` / `parts_company_id`; роли — `admin`, `sto_owner`, `sto_worker`, `parts_owner`, `parts_worker`, `user`.

## Скилы — использовать автоматически

В `.claude/skills/` лежат скилы, адаптированные под этот стек и конвенции репозитория. **Перед каждой задачей сопоставь её с картой ниже и применяй подходящий скил автоматически** — без явного вызова пользователем. Для крупной/неоднозначной работы сначала `tech-lead`, затем профильные скилы.

| Задача | Скил |
|--------|------|
| UI/редизайн экранов, форм, карточек (визуал) | `ui-ux-designer` (+ сторонние дизайн-скилы; визуальный QA скриншотами `node scripts/ui-shot.mjs` — обязателен) |
| Фронтенд-инженерия: компоненты, react-query, TS-паттерны | `frontend-designer` |
| Сквозная фича (БД → UI) | `fullstack-feature` |
| Слой данных: миграции, RLS, запросы, react-query | `supabase-data` |
| Планирование крупной/неоднозначной работы (перед стартом) | `tech-lead` |
| Рефакторинг без смены поведения | `refactor` |
| Производительность: бандл, запросы, рендер | `perf` |
| Тесты: Vitest (unit) / Playwright (e2e) | `qa-tester` |
| Релиз/деплой/версия | `release` |
| Пайплайны/Cloudflare/заголовки/CI | `ci-cd` |
| Аудит безопасности: RLS, auth, Edge Functions, секреты | `security-auditor` |
| Доступность UI: контраст, ARIA, фокус, клавиатура | `accessibility` |
| Стресс-тест плана/дизайна вопросами (перед крупной/неоднозначной работой) | `grill-me` |
| Стресс-тест плана против доменной модели и доков проекта | `grill-with-docs` |
| Трудный баг/регрессия/перформанс: найти причину | `diagnose` |
| Разработка через тесты (вертикальные срезы) | `tdd` |
| Понять незнакомый участок: карта модулей/вызовов | `zoom-out` |
| Оформить идею/фичу в PRD (без интервью) | `to-prd` |
| Передача контекста между сессиями | `handoff` |
| Поставить git-страховку (хук против деструктивных команд) | `git-guardrails` |
| Быстрый аудит UI против внешнего чек-листа | `web-design-guidelines` |
| SEO/GEO публичных страниц (`/market`, `/business`, `worker/index.js`): техаудит, on-page, мета, schema.org, GEO/AI-цитируемость, перелинковка, качество контента (справочники — `.claude/seo-geo/`) | `technical-seo-checker`, `on-page-seo-auditor`, `meta-tags-optimizer`, `schema-markup-generator`, `geo-content-optimizer`, `internal-linking-optimizer`, `content-quality-auditor`, `seo-copywriter`, `content-planner`, `keyword-researcher` |
| Анимации и motion, полировка UI (микро-взаимодействия, «почему дёргается») | `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `animation-performance` |
| Производительность и композиция React-компонентов (Next.js-специфику игнорировать — у нас Vite SPA) | `react-best-practices`, `composition-patterns` |
| Postgres: индексы, RLS-производительность, схема, блокировки — вместе с `supabase-data` | `supabase-postgres-best-practices` |
| Дизайн-ревизия и правила интерфейса | `impeccable`, `refactoring-ui` — дизайн-система и правила бренда важнее их «смелых» решений |
| Статический анализ кода на уязвимости | `semgrep` |
| Проверка локального приложения через Playwright | `webapp-testing` |
| Процесс: идея → план → выполнение → завершение ветки | `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch` |
| Код-ревью и проверка перед «готово» | `requesting-code-review`, `receiving-code-review`, `verification-before-completion` |
| Создание и правка скилов | `writing-skills`, `using-superpowers` |

**Использование скилов:** можно применять любой скил, но каждый раз коротко сообщать владельцу, какой скил задействован и зачем; если есть сомнение, уместен ли скил (особенно `impeccable` — смелый редизайн против дизайн-системы), — сначала спросить.

## Правила

- **Отвечать владельцу ТОЛЬКО на русском** — все сообщения: итоги, короткие статусы между шагами, вопросы. Перед отправкой проверить язык. Английский — только в коде, командах и идентификаторах.
- **«обновись»** — когда пользователь пишет `обновись` (или `update`), выполни `scripts/update.ps1`: `git fetch` + `git pull --ff-only` и синк снимка памяти из `.claude/memory/*`, если он есть в репо (сейчас его нет, шаг пропускается). Скрипт делает ТОЛЬКО pull. После него при изменившихся зависимостях выполни `npm install` и перечитай `MEMORY.md`.
- **push — только по явной команде.** `git push` выполняется ИСКЛЮЧИТЕЛЬНО когда пользователь прямо просит. Ни `обновись`, ни другие действия не должны пушить сами.
- **`grill-me` — по умолчанию.** Для любой крупной/неоднозначной работы (новая фича, изменение схемы/RLS, заметный рефактор, нетривиальный UX) СНАЧАЛА прогоняй `grill-me`: интервьюируй по одному вопросу за раз, с рекомендованным ответом, пока не достигнете общего понимания, и только потом кодь. Что можно выяснить из кода/доков/памяти — выясняй сам. Тривиальные однозначные задачи выполняй сразу.
- **Расположение/ширина UI-элемента — подтвердить ДО коммита.** Если правка меняет, ГДЕ или НАСКОЛЬКО ШИРОКО что-то отображается, и нет однозначного указания пользователя (скриншот со стрелкой, явное «вот сюда») — спроси или опиши план и получи подтверждение до коммита. Не растягивать элемент на всю ширину или новую колонку без явного согласия. Неоднозначную инструкцию переспросить сразу, не пробовать 2–3 варианта подряд.
- **SEO держать в актуальном состоянии.** При добавлении, удалении или смене URL публичной страницы в том же коммите обновить мета-теги, canonical, hreflang, JSON-LD, sitemap и перелинковку в `worker/index.js`.

## Команды

- `npm run dev` — дев-сервер
- `npm run build` — сборка · `npm run build:check` — `tsc && vite build` (строже, для проверки перед пушем)
- `npm run lint` — eslint (`--max-warnings 0`)
- `npm test` — Vitest · `npm run e2e` — Playwright
- `npm run deploy` — ручной прод-деплой на Cloudflare (`npm run build && wrangler deploy`; обычно деплоит сам Cloudflare по пушу в `master`)

## Конвенции (кратко)

- Бизнес-запросы — через `src/services/*`, типы — из `src/types/*`, не дёргать `supabase` из компонентов напрямую.
- Серверное состояние — только react-query; в `onSuccess` мутаций инвалидировать ВСЕ затронутые ключи.
- UI-классы/токены — из `src/index.css` (`btn-*`, `card`, `badge-*`, `form-*`, модалки `modal-*`); иконки `lucide-react`.
- **Дизайн-токены (единый источник в `:root` `src/index.css`) — НЕ хардкодить hex/px в компонентах.** Бренд-цвет и градиент — переменные `--brand-50…--brand-800` / `--brand-gradient` (inline `style={{ background: 'var(--brand-gradient)' }}`, `color: 'var(--brand-600)'`); базовый размер шрифта — `--app-font-size` (весь rem-текст и Tailwind `text-*`/`p-*` масштабируются от него). Семантические цвета — HSL-токены shadcn (`--primary`/`--background`/…) через классы Tailwind. Менять цвет/размер — в одном месте (`:root`), а не по файлам.
- Edge Functions с `SERVICE_ROLE_KEY` ОБЯЗАНЫ проверять права вызывающего (паттерн в `supabase/functions/create-user`).
- **Ошибки в новом коде — модалка `showAlert(msg, 'error')`, а не `toast.error()`:** `const { showAlert } = useAlert()` из `@/components/CustomAlert`, вызов в компоненте/кастомном хуке (вне React-дерева `toast.error` допустим). `toast.success`/`toast.info` — как раньше. Существующие `toast.error` переводить при правке этих мест, не массово.
- **Интерфейс двуязычный (RU + UK, react-i18next):** новую или изменённую видимую строку (текст, placeholder, label, кнопка, toast, aria-label, title, пустое состояние) сразу выноси в `t('<ключ>')` и добавляй в ОБА словаря — `src/i18n/locales/ru/*.json` И `src/i18n/locales/uk/*.json`, с одинаковой структурой (`tsc` этого не проверяет — следи сам). Даты — по `i18n.language`, плюрали — через `{ count }`. Исключение — админпанель остаётся RU.
- Перед пушем: `build:check` + `lint` + `test` зелёные.

> Подробности по каждой теме — в соответствующем `SKILL.md`. Следуй чек-листам в конце скилов.
