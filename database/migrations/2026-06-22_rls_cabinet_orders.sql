-- SECURITY: RLS + company-isolation на кабинетных таблицах заказов/клиентов.
-- Было: RLS выключена → любой залогиненный читал/правил чужие заказы и клиентов (PII).
-- Ядовитые политики: parts_orders_update_anon/authenticated = USING(true) (правка любого
-- заказа), parts_order_items anon SELECT = чтение всех позиций. Применено через Management API.

-- Хелпер: принадлежит ли компания текущему пользователю (или он admin). SECURITY DEFINER —
-- читает user_profiles/user_roles вне их RLS.
create or replace function public.is_my_parts_company(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select cid is not null and (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.parts_company_id = cid)
    or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
               where ur.user_id = auth.uid() and r.name = 'admin')
  );
$$;

-- Снос ядовитых/широких политик.
drop policy if exists "parts_orders_update_anon" on public.parts_orders;
drop policy if exists "parts_orders_update_authenticated" on public.parts_orders;
drop policy if exists "Allow public access to parts_order_items" on public.parts_order_items;

-- parts_orders: RLS + запись по своей компании (SELECT-политика company-isolation уже есть).
alter table public.parts_orders enable row level security;
create policy "parts_orders_insert" on public.parts_orders for insert to authenticated
  with check (public.is_my_parts_company(parts_company_id));
create policy "parts_orders_update" on public.parts_orders for update to authenticated
  using (public.is_my_parts_company(parts_company_id)) with check (public.is_my_parts_company(parts_company_id));
create policy "parts_orders_delete" on public.parts_orders for delete to authenticated
  using (public.is_my_parts_company(parts_company_id));

-- parts_order_items: RLS + доступ через родительский заказ.
alter table public.parts_order_items enable row level security;
create policy "parts_order_items_select" on public.parts_order_items for select to authenticated
  using (exists (select 1 from public.parts_orders o where o.id = parts_order_items.order_id and public.is_my_parts_company(o.parts_company_id)));
create policy "parts_order_items_insert" on public.parts_order_items for insert to authenticated
  with check (exists (select 1 from public.parts_orders o where o.id = parts_order_items.order_id and public.is_my_parts_company(o.parts_company_id)));
create policy "parts_order_items_update" on public.parts_order_items for update to authenticated
  using (exists (select 1 from public.parts_orders o where o.id = parts_order_items.order_id and public.is_my_parts_company(o.parts_company_id)));
create policy "parts_order_items_delete" on public.parts_order_items for delete to authenticated
  using (exists (select 1 from public.parts_orders o where o.id = parts_order_items.order_id and public.is_my_parts_company(o.parts_company_id)));

-- parts_customers: RLS + insert/update (SELECT + DELETE уже есть).
alter table public.parts_customers enable row level security;
create policy "parts_customers_insert" on public.parts_customers for insert to authenticated
  with check (public.is_my_parts_company(parts_company_id));
create policy "parts_customers_update" on public.parts_customers for update to authenticated
  using (public.is_my_parts_company(parts_company_id)) with check (public.is_my_parts_company(parts_company_id));

-- parts_order_counter: RLS + всё по своей компании (счётчик номеров заказов).
alter table public.parts_order_counter enable row level security;
create policy "parts_order_counter_all" on public.parts_order_counter for all to authenticated
  using (public.is_my_parts_company(parts_company_id)) with check (public.is_my_parts_company(parts_company_id));
