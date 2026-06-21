-- SECURITY: VIEW market_inventory — публичная витрина с safe-полями (без закупочных колонок).
-- Закрывает узкую утечку: authenticated больше НЕ может прочитать чужой purchase_price у
-- published+available строк базовой parts_inventory. Маркет-фронт (getMarketParts/Part/Related/
-- Categories) читает витрину через эту view; публичное чтение базовой parts_inventory сужено
-- до anon-only. Применено через Management API (ref hwckvddevjucuzxdoqqh).

create or replace view public.market_inventory with (security_invoker = false) as
select pi.id, pi.parts_company_id, pi.category_id, pi.vehicle_id, pi.name, pi.article,
       pi.part_number, pi.description, pi.condition, pi.quantity, pi.reserved_quantity,
       pi.selling_price, pi.price_currency, pi.photo_url, pi.photos, pi.status, pi.created_at
from public.parts_inventory pi
join public.parts_companies c on c.id = pi.parts_company_id
where pi.status = 'available' and pi.selling_price > 0 and c.is_active and c.market_published;

grant select on public.market_inventory to anon, authenticated;

-- Базовая parts_inventory: публичное чтение только anon (authenticated читает витрину через view
-- и не получает чужой purchase_price; свою компанию видит по company-isolation политике).
drop policy if exists "Public market inventory read" on public.parts_inventory;
create policy "Public market inventory read" on public.parts_inventory for select to anon
  using (
    status = 'available' and selling_price > 0
    and parts_company_id in (select id from public.parts_companies where is_active and market_published)
  );
