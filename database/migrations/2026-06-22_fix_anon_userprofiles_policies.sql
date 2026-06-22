-- FIX: после отзыва у anon чтения user_profiles (rls_user_profiles.sql) сломались
-- анонимные запросы к таблицам, чьи RLS-политики (с roles=public/null) внутри читают
-- user_profiles — Postgres вычисляет такую политику для anon и упирается в
-- «permission denied for table user_profiles» → весь запрос падает.
-- Симптом: витрина маркета (эмбед parts_companies) и публичный QR места хранения
-- не грузились без авторизации.
-- Решение: эти «company isolation» политики касаются только членов компании →
-- ограничиваем их ролью authenticated (anon их и так никогда не проходил), а где надо
-- читать user_profiles — через SECURITY DEFINER хелперы (my_parts_company_id/is_admin).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh). Проверено anon-REST.

-- parts_companies: members-политика читала user_profiles напрямую → ломала эмбед витрины.
drop policy if exists "Parts company members can view their company" on public.parts_companies;
create policy "Parts company members can view their company" on public.parts_companies
  for select to authenticated using (id = public.my_parts_company_id());

-- Остальные «company isolation» SELECT/ALL политики (roles=public) → только authenticated.
alter policy "Parts owners see worker requests" on public.access_requests to authenticated;
alter policy "Parts customers company isolation" on public.parts_customers to authenticated;
alter policy "Parts inventory company isolation" on public.parts_inventory to authenticated;
alter policy "Parts orders company isolation" on public.parts_orders to authenticated;
alter policy "parts_storage_locations_select" on public.parts_storage_locations to authenticated;
alter policy "Parts company members can view their suppliers" on public.parts_suppliers to authenticated;
alter policy "Parts company members can view their vehicle categories" on public.parts_vehicle_categories to authenticated;
alter policy "System can manage vehicle categories" on public.parts_vehicle_categories to authenticated;
alter policy "subreq_select" on public.subscription_requests to authenticated;
