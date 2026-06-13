-- Серверная агрегация аналитики кабинета одним RPC (вместо выгрузки всех заказов/склада на клиент).
-- Применено вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
-- Возвращает числа + помесячные бакеты ключом YYYY-MM (формат месяца — на клиенте) + топ-5 запчастей.
-- Повторяет клиентскую логику toUSD: USD как есть, иначе / (vehicle.exchange_rate || p_rate).
create or replace function public.get_parts_analytics(p_company uuid, p_rate numeric default 41)
returns json language sql stable security invoker as $fn$
with inv as (
  select i.status, i.price_currency, i.selling_price, i.sold_price, i.purchase_price, i.quantity, i.name,
         coalesce(nullif(v.exchange_rate,0), p_rate, 41) as rate
  from public.parts_inventory i left join public.parts_vehicles v on v.id = i.vehicle_id
  where i.parts_company_id = p_company
),
sold as (select * from inv where status='sold'),
nonsold as (select * from inv where status <> 'sold'),
sold_rev as (select coalesce(sum(case when price_currency='USD' then coalesce(sold_price,selling_price,0)
                                       else coalesce(sold_price,selling_price,0)/rate end),0) v from sold),
comp as (select count(*) c from public.parts_orders where parts_company_id=p_company and status='completed'),
monthly as (
  select to_char(o.order_date,'YYYY-MM') m,
         sum(case when oi.price_at_sale_currency='USD' then coalesce(oi.price_at_sale,0)*coalesce(oi.quantity,1)
                  else (coalesce(oi.price_at_sale,0)*coalesce(oi.quantity,1))/coalesce(nullif(p_rate,0),41) end) revenue,
         count(distinct o.id) orders
  from public.parts_orders o join public.parts_order_items oi on oi.order_id=o.id
  where o.parts_company_id=p_company and o.status='completed' group by 1
)
select json_build_object(
  'totalRevenue', (select v from sold_rev),
  'totalOrders', (select count(*) from public.parts_orders where parts_company_id=p_company),
  'completedOrders', (select c from comp),
  'totalSoldParts', (select count(*) from sold),
  'avgCheck', case when (select c from comp)>0 then (select v from sold_rev)/(select c from comp) else 0 end,
  'inventoryValue', coalesce((select sum(case when price_currency='USD' then coalesce(selling_price,0)*coalesce(quantity,0) else (coalesce(selling_price,0)*coalesce(quantity,0))/rate end) from nonsold),0),
  'potentialMargin', coalesce((select sum(case when price_currency='USD' then (selling_price-purchase_price)*coalesce(quantity,1) else ((selling_price-purchase_price)*coalesce(quantity,1))/rate end) from nonsold where coalesce(selling_price,0)>0 and coalesce(purchase_price,0)>0),0),
  'totalVehicles', (select count(*) from public.parts_vehicles where parts_company_id=p_company),
  'dismantledVehicles', (select count(*) from public.parts_vehicles where parts_company_id=p_company and status='dismantled'),
  'monthly', coalesce((select json_agg(json_build_object('month',m,'revenue',revenue,'orders',orders) order by m) from (select * from monthly order by m desc limit 6) s),'[]'::json),
  'topParts', coalesce((select json_agg(t) from (
       select name, count(*) sold_quantity,
              sum(case when price_currency='USD' then coalesce(sold_price,selling_price,0) else coalesce(sold_price,selling_price,0)/rate end) revenue
       from sold group by name order by count(*) desc limit 5) t),'[]'::json)
);
$fn$;
grant execute on function public.get_parts_analytics(uuid, numeric) to authenticated;
