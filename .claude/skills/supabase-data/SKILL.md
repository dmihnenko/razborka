---
name: supabase-data
description: Слой данных на Supabase в этом проекте — SQL-миграции, RLS-политики, запросы и паттерны react-query под текущую схему БД. Используй, когда задача касается базы или доступа к данным: новые поля/таблицы, изменение constraint'ов, политики безопасности, оптимизация запросов, ключи и инвалидация кэша.
---

# Supabase / слой данных (этот проект)

Работай со схемой и доступом к данным консистентно с существующим кодом. Перед изменениями посмотри соседние миграции в `database/migrations/` и сервисы в `src/services/`.

## Миграции SQL (`database/migrations/*.sql`)
- **Идемпотентность обязательна:** `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Изменение constraint'ов — через `DO $$ ... END $$` с проверкой `pg_constraint` (как в `add_appointment_payment_fields.sql`).
- Комментарии на русском, поясняй назначение полей.
- Имя файла — снейк-кейс по смыслу: `add_<что>_to_<таблица>.sql`, `create_<таблица>.sql`, `fix_<что>.sql`.
- FK на пользователей: `REFERENCES auth.users(id) ON DELETE SET NULL`.
- Статусы заявок ограничены CHECK: `('scheduled','in_progress','completed','archived')` (+ при необходимости `cancelled`,`pending_deletion`,`deleted` — сверься с актуальным constraint).
- **Не применяй миграции к боевой БД сам.** Создай файл и опиши шаги применения (Supabase SQL editor). Деструктивные операции (DROP, потеря данных) — только после явного подтверждения.

## RLS и безопасность (критично)
- Приложение **мультитенантное**: строки изолированы по `sto_company_id`. Это первичная граница безопасности.
- Новые таблицы с бизнес-данными: включай RLS и политику по компании (паттерн — `add_appointments_rls.sql`).
- В коде **каждый** запрос по бизнес-данным фильтруй: `.eq('sto_company_id', profile.sto_company_id)`. Без контекста компании возвращай пусто, не «все строки» (см. `customersService.fetchCustomers`).

## Запросы (`src/services/*.ts` и инлайн в хуках)
- Чистые async-функции, `const { data, error } = await supabase...; if (error) throw error; return data`.
- Связи через вложенный select: `select('*, customers(name, phone), vehicles(brand, model)')`.
- Фильтры статусов: `.not('status','in','(archived,deleted)')`, `.in('status', [...])`.
- Остерегайся N+1 (в проекте есть, напр. подсчёт авто на клиента) — где возможно, агрегируй на стороне БД/одним запросом.

## react-query (`src/hooks/*.ts`)
- `useQuery({ queryKey: ['<domain>', ...deps], queryFn, enabled: !!profile?.sto_company_id, staleTime })`. В `queryKey` включай все переменные, влияющие на результат (id компании, фильтры).
- Мутации: в `onSuccess` — `queryClient.invalidateQueries({ queryKey: [...] })` для **всех** затронутых ключей (напр. и `['appointments']`, и `['board-kanban']`, и `['dashboard-...']`), затем `toast.success`; `onError` → `toast.error(err.message)`.
- Не забывай инвалидировать связанные дашборд/статистику ключи при изменении заявок.

## Проверка
- `npx vite build` проходит. Для логики данных — по возможности добавь/обнови тест рядом (в репо есть `*.test.ts` для сервисов, запуск `npm test`).
