-- SECURITY: закрытие дыры RLS на parts_inventory.
-- Было: RLS выключена + у anon ПОЛНЫЕ права (INSERT/UPDATE/DELETE/TRUNCATE + SELECT всех
-- колонок), у authenticated — доступ ко всем компаниям. Аноним мог менять/удалять данные
-- и читать закупочные цены/заметки; залогиненный — данные чужих разборок.
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh). Проверено симуляцией ролей.

-- 1) anon: только чтение безопасных колонок, никаких записей.
revoke all on public.parts_inventory from anon;
grant select (
  id, parts_company_id, category_id, vehicle_id, name, article, part_number, description,
  condition, quantity, reserved_quantity, selling_price, price_currency, photo_url, photos,
  status, created_at
) on public.parts_inventory to anon;

-- 2) Включаем RLS (SELECT-политика company-isolation уже существует).
alter table public.parts_inventory enable row level security;

-- 3) Публичное чтение витрины (anon + authenticated): только опубликованные доступные позиции.
drop policy if exists "Public market inventory read" on public.parts_inventory;
create policy "Public market inventory read"
  on public.parts_inventory for select to anon, authenticated
  using (
    status = 'available' and selling_price > 0
    and parts_company_id in (select id from public.parts_companies where is_active and market_published)
  );

-- 4) Изоляция по компании для записи (зеркало существующей SELECT-политики: свой company или admin).
drop policy if exists "Parts inventory company insert" on public.parts_inventory;
create policy "Parts inventory company insert"
  on public.parts_inventory for insert to authenticated
  with check (
    (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
             where ur.user_id = auth.uid() and r.name = 'admin'))
    or parts_company_id in (select user_profiles.parts_company_id from public.user_profiles where user_profiles.id = auth.uid())
  );

drop policy if exists "Parts inventory company update" on public.parts_inventory;
create policy "Parts inventory company update"
  on public.parts_inventory for update to authenticated
  using (
    (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
             where ur.user_id = auth.uid() and r.name = 'admin'))
    or parts_company_id in (select user_profiles.parts_company_id from public.user_profiles where user_profiles.id = auth.uid())
  )
  with check (
    (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
             where ur.user_id = auth.uid() and r.name = 'admin'))
    or parts_company_id in (select user_profiles.parts_company_id from public.user_profiles where user_profiles.id = auth.uid())
  );

drop policy if exists "Parts inventory company delete" on public.parts_inventory;
create policy "Parts inventory company delete"
  on public.parts_inventory for delete to authenticated
  using (
    (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
             where ur.user_id = auth.uid() and r.name = 'admin'))
    or parts_company_id in (select user_profiles.parts_company_id from public.user_profiles where user_profiles.id = auth.uid())
  );
