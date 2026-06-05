---
name: fullstack-feature
description: Реализация сквозной фичи в этом проекте (СТО/разборка, React+TS+Vite+Supabase). Используй, когда нужно добавить или изменить функциональность, затрагивающую данные и UI — от схемы БД до экрана. Проводит фичу по слоям: SQL-миграция → Supabase-запрос/RLS → react-query хук → компонент/страница → роут в App.tsx, строго по конвенциям репозитория.
---

# Full-stack feature (этот проект)

Реализуй фичу end-to-end, **повторяя существующие паттерны**, а не вводя новые. Сначала найди ближайшую похожую фичу (`customers`, `appointments`, `vehicles`, `parts`) и копируй её структуру.

## Стек и расположение
- React 18 + TypeScript + Vite. Алиас `@/` → `src/`.
- Данные: Supabase (`src/lib/supabase.ts` экспортирует `supabase`).
- Слои:
  - `src/types/<domain>.ts` — типы домена.
  - `src/services/<domain>Service.ts` — функции доступа к данным (чистые async-функции, `throw error`).
  - `src/hooks/use*.ts` — обёртки react-query (`useQuery`/`useMutation`).
  - `src/components/<domain>/*.tsx` — UI-блоки; `src/pages/*.tsx` — страницы.
  - `src/App.tsx` — роуты, вложены в `<Layout>` (контейнер `max-w-[1440px]`).
  - `database/migrations/*.sql` — миграции БД.

## Порядок работы
1. **Разведка.** Прочитай ближайшую похожую фичу целиком (service + hook + page). Повтори её стиль.
2. **Схема БД** (если нужны новые поля/таблицы). Напиши идемпотентную миграцию в `database/migrations/` — см. скил `supabase-data`. Не применяй её сам к боевой БД; оставь файл и опиши шаги применения.
3. **Запросы.** Добавь функцию в `*Service.ts` ИЛИ инлайн-запрос в хук — как в соседних файлах. **Безопасность (критично):** все запросы по бизнес-данным фильтруй по `sto_company_id` (мультитенантность). Никогда не возвращай все строки без фильтра компании — см. `customersService.ts`.
4. **react-query.** Хук с массивом `queryKey` (включай зависимые id: `['appointments', profile?.id, ...]`), `enabled: !!profile?.sto_company_id`, разумный `staleTime`. Мутации в `onSuccess` делают `queryClient.invalidateQueries({ queryKey: [...] })` для всех затронутых ключей и тост `toast.success(...)` (из `sonner`); `onError` → `toast.error(...)`.
5. **UI.** Строй из дизайн-токенов (`btn-primary`, `card`, `stat-card`, `form-input`, `badge-*`, `modal-*`). Mobile-first, тексты на русском, иконки `lucide-react`. Подробности — скил `ui-ux-designer`.
6. **Роут.** Добавь `lazy(() => import(...))` и `<Route>` внутрь `<Layout>` в `App.tsx`, рядом с похожими.
7. **Проверка.** `npx vite build` должен пройти. (Проект не гейтит на `tsc` — есть предсуществующий долг unused-locals, но **новых** не вводи.)

## Правила
- Не добавляй зависимости без необходимости — сверься с `package.json`.
- Профиль/компания берутся из `useUserProfile()` → `profile.sto_company_id`, `profile.id`, роли `profile.roles`.
- Роль владельца: `profile?.roles?.some(r => r.name === 'sto_owner')`.
- Деньги — `₴`, формат `toLocaleString('ru-RU')`.
- После завершения честно сообщи: что сделано, прошла ли сборка, какие миграции нужно применить вручную.
