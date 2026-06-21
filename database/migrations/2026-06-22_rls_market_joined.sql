-- SECURITY: RLS на таблицах, которые читает публичный маркет через эмбеды
-- (parts_categories — имена категорий; parts_vehicles — авто-доноры).
-- Чтение оставляем публичным (нужно витрине), запись — только своя компания.
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

-- parts_categories: чтение всем (имена не секрет; нужны каталогу/эмбедам/шаблонам),
-- запись — только своя компания.
alter table public.parts_categories enable row level security;
create policy "parts_categories_public_select" on public.parts_categories for select to anon, authenticated
  using (true);
create policy "parts_categories_insert" on public.parts_categories for insert to authenticated
  with check (public.is_my_parts_company(parts_company_id));
create policy "parts_categories_update" on public.parts_categories for update to authenticated
  using (public.is_my_parts_company(parts_company_id)) with check (public.is_my_parts_company(parts_company_id));
create policy "parts_categories_delete" on public.parts_categories for delete to authenticated
  using (public.is_my_parts_company(parts_company_id));

-- parts_vehicles: чтение — своя компания или авто опубликованных разборок (для витрины),
-- запись — только своя компания.
alter table public.parts_vehicles enable row level security;
create policy "parts_vehicles_select" on public.parts_vehicles for select to authenticated
  using (
    public.is_my_parts_company(parts_company_id)
    or parts_company_id in (select id from public.parts_companies where is_active and market_published)
  );
create policy "parts_vehicles_public_select" on public.parts_vehicles for select to anon
  using (parts_company_id in (select id from public.parts_companies where is_active and market_published));
create policy "parts_vehicles_insert" on public.parts_vehicles for insert to authenticated
  with check (public.is_my_parts_company(parts_company_id));
create policy "parts_vehicles_update" on public.parts_vehicles for update to authenticated
  using (public.is_my_parts_company(parts_company_id)) with check (public.is_my_parts_company(parts_company_id));
create policy "parts_vehicles_delete" on public.parts_vehicles for delete to authenticated
  using (public.is_my_parts_company(parts_company_id));
