-- Связь ТТН ↔ запчасти (опционально): какие позиции склада едут в накладной.
-- Many-to-many parts_shipments ↔ parts_inventory. RLS по parts_company_id.

create table if not exists public.parts_shipment_items (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references public.parts_shipments(id)  on delete cascade,
  inventory_item_id uuid not null references public.parts_inventory(id)  on delete cascade,
  parts_company_id  uuid not null references public.parts_companies(id)  on delete cascade,
  created_at        timestamptz not null default now(),
  unique (shipment_id, inventory_item_id)
);

create index if not exists idx_parts_shipment_items_shipment on public.parts_shipment_items(shipment_id);
create index if not exists idx_parts_shipment_items_company  on public.parts_shipment_items(parts_company_id);

alter table public.parts_shipment_items enable row level security;

drop policy if exists parts_shipment_items_all on public.parts_shipment_items;
create policy parts_shipment_items_all on public.parts_shipment_items
  for all to authenticated
  using      (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()))
  with check (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()));
