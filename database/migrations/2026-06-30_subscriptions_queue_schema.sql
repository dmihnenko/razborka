-- ЭТАП 1. Схема очереди подписок: несколько строк на компанию (active + frozen/scheduled).
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-30.
--
-- Было: ровно одна строка на (company_type, company_id) — жёсткий UNIQUE.
-- Стало: одна АКТИВНАЯ строка на компанию (частичный уникальный индекс where is_active),
-- плюс произвольное число неактивных строк-очереди:
--   status='frozen'    — апгрейд заморозил прежний план; remaining_days = остаток дней.
--   status='scheduled' — даунгрейд куплен наперёд; sched_months = срок при будущем старте.
--   status='ended'     — завершённая (история).
--   status='active'    — текущая действующая (is_active=true).

-- ── 1. Новые колонки состояния очереди ───────────────────────────────────────
alter table public.company_subscriptions
  add column if not exists status text not null default 'active',
  add column if not exists remaining_days int,
  add column if not exists sched_months int;

-- check на допустимые статусы (idempotent)
do $do$ begin
  alter table public.company_subscriptions
    add constraint company_subscriptions_status_check
    check (status in ('active','frozen','scheduled','ended'));
exception when duplicate_object then null; end $do$;

-- существующие активные строки уже status='active' (default) — синхронизируем явно
update public.company_subscriptions set status = 'active' where is_active and status <> 'active';

-- ── 2. Снять жёсткий UNIQUE(company_type, company_id) ─────────────────────────
alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_company_type_company_id_key;

-- ── 3. Частичный уникальный индекс: «одна активная на компанию» ───────────────
create unique index if not exists uniq_company_active_sub
  on public.company_subscriptions (company_type, company_id)
  where is_active;
