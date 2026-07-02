-- ============================================================================
-- TSP — Маркетплейс запчастей: заявки покупателей (marketplace orders)
-- ============================================================================
-- Применено 2026-06-12 к tsp.pp.ua (hwckvddevjucuzxdoqqh).
--
-- Публичный каталог читается анонимно из parts_inventory/parts_vehicles/
-- parts_categories (RLS на них выключен, есть grant для anon) — отдельные политики
-- чтения не нужны. Заявки же содержат телефоны покупателей, поэтому таблицы заявок
-- идут с включённым RLS: аноним только ОТПРАВЛЯЕТ через SECURITY DEFINER RPC,
-- а читает/обновляет только своя разборка (по parts_company_id) или админ.
-- ============================================================================

-- ── Таблицы ────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  parts_company_id uuid not null references public.parts_companies(id) on delete cascade,
  buyer_name  text,
  buyer_phone text not null,
  comment     text,
  status      text not null default 'new',   -- new | viewed | closed
  total_amount numeric default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_marketplace_orders_company on public.marketplace_orders(parts_company_id, created_at desc);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.marketplace_orders(id) on delete cascade,
  inventory_id uuid references public.parts_inventory(id) on delete set null,
  name         text not null,
  selling_price numeric,
  price_currency text default 'UAH',
  quantity     integer not null default 1,
  photo_url    text
);
create index if not exists idx_marketplace_order_items_order on public.marketplace_order_items(order_id);

-- ── Гранты (anon только исполняет RPC; чтение/обновление — authenticated) ────
grant select, update on public.marketplace_orders to authenticated;
grant select on public.marketplace_order_items to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;

-- Читать/обновлять заявки может только своя разборка (по parts_company_id) или админ
create policy "market_orders_select" on public.marketplace_orders for select to authenticated using (
  parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid())
  or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and r.name = 'admin')
);
create policy "market_orders_update" on public.marketplace_orders for update to authenticated using (
  parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid())
  or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and r.name = 'admin')
);
create policy "market_order_items_select" on public.marketplace_order_items for select to authenticated using (
  order_id in (
    select id from public.marketplace_orders
    where parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid())
  )
  or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and r.name = 'admin')
);

-- ── RPC анонимной отправки заявки (создаёт заказ + позиции атомарно) ──────────
create or replace function public.submit_marketplace_order(
  p_company_id uuid, p_buyer_phone text, p_buyer_name text, p_comment text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_total numeric := 0;
  it jsonb;
begin
  if p_buyer_phone is null or length(regexp_replace(p_buyer_phone, '\D', '', 'g')) < 7 then
    raise exception 'Некорректный номер телефона';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Пустая заявка';
  end if;

  insert into public.marketplace_orders (parts_company_id, buyer_phone, buyer_name, comment)
  values (p_company_id, p_buyer_phone, nullif(trim(p_buyer_name), ''), nullif(trim(p_comment), ''))
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.marketplace_order_items (order_id, inventory_id, name, selling_price, price_currency, quantity, photo_url)
    values (
      v_order_id,
      nullif(it->>'inventory_id','')::uuid,
      coalesce(it->>'name','Запчасть'),
      nullif(it->>'selling_price','')::numeric,
      coalesce(it->>'price_currency','UAH'),
      greatest(coalesce((it->>'quantity')::int, 1), 1),
      it->>'photo_url'
    );
    v_total := v_total + coalesce(nullif(it->>'selling_price','')::numeric, 0) * greatest(coalesce((it->>'quantity')::int, 1), 1);
  end loop;

  update public.marketplace_orders set total_amount = v_total where id = v_order_id;
  return v_order_id;
end; $$;

grant execute on function public.submit_marketplace_order(uuid, text, text, text, jsonb) to anon, authenticated;
