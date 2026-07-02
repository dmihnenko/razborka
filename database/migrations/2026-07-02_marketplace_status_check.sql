-- Целостность (2026-07-02): marketplace_orders.status был text без CHECK —
-- фронт использует строгий union ('new'|'viewed'|'closed'|'cancelled'), но БД
-- принимала любое значение. Добавляем CHECK (таблица на момент миграции пуста).
-- Применяется вручную через Management API.

alter table public.marketplace_orders
  drop constraint if exists marketplace_orders_status_check;
alter table public.marketplace_orders
  add constraint marketplace_orders_status_check
  check (status in ('new', 'viewed', 'closed', 'cancelled'));
