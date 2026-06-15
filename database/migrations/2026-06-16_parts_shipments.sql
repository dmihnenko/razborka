-- Волна 4: трекинг посылок (ТТН Новой Почты) по заказам разборки.
-- Одна строка = одна накладная. Статус обновляется по запросу (кнопка «Обновить»)
-- или периодически (cron — добавим позже). RLS — по parts_company_id.
--
-- ⚠️ Применять ВРУЧНУЮ в Supabase (prod отстаёт от репо).

create table if not exists public.parts_shipments (
  id                  uuid primary key default gen_random_uuid(),
  parts_company_id    uuid not null references public.parts_companies(id) on delete cascade,
  order_id            uuid references public.parts_orders(id) on delete set null,
  ttn                 text not null,
  np_ref              text,
  recipient_name      text,
  recipient_phone     text,
  recipient_city      text,
  recipient_warehouse text,
  status              text,            -- человекочитаемый статус НП
  status_code         text,           -- StatusCode НП
  cod_amount          numeric,         -- наложенный платёж (ожидается к получению)
  status_updated_at   timestamptz,
  last_checked_at     timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_parts_shipments_company on public.parts_shipments(parts_company_id);
create index if not exists idx_parts_shipments_order   on public.parts_shipments(order_id);
create index if not exists idx_parts_shipments_ttn     on public.parts_shipments(ttn);

alter table public.parts_shipments enable row level security;

drop policy if exists parts_shipments_all on public.parts_shipments;
create policy parts_shipments_all on public.parts_shipments
  for all to authenticated
  using      (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()))
  with check (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()));
