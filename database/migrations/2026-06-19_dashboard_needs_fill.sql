-- Дашборд: блок «без цены» → «требуют заполнения» (нет цены ИЛИ нет оригинального номера).
-- Переименован ключ inventory.noPrice → inventory.needsFill, расширен критерий.
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

create or replace function public.get_parts_dashboard_stats(p_company uuid, p_rate numeric default 41)
returns json language sql stable security invoker as $fn$
  select json_build_object(
    'vehicles', (select json_build_object('total',count(*),'awaiting',count(*) filter (where status='awaiting'),
        'in_progress',count(*) filter (where status='in_progress'),'dismantled',count(*) filter (where status='dismantled'))
      from public.parts_vehicles where parts_company_id=p_company),
    'inventory', (select json_build_object('total',coalesce(sum(quantity),0),
        'available',coalesce(sum(quantity-coalesce(reserved_quantity,0)),0),
        'lowStock',count(*) filter (where quantity<=coalesce(min_stock_level,0)),
        'needsFill',count(*) filter (where selling_price is null or selling_price=0
            or part_number is null or btrim(part_number)=''),
        'valueUSD',coalesce(sum(coalesce(selling_price,0)*coalesce(quantity,0)) filter (where price_currency='USD' or price_currency is null),0),
        'valueUAH',coalesce(sum(coalesce(selling_price,0)*coalesce(quantity,0)) filter (where price_currency='UAH'),0),
        'fromVehicles',coalesce(sum(quantity) filter (where vehicle_id is not null),0),
        'fromShop',coalesce(sum(quantity) filter (where vehicle_id is null),0))
      from public.parts_inventory where parts_company_id=p_company and status<>'sold'),
    'orders', (select json_build_object('total',count(*),'new',count(*) filter (where status='new'),
        'in_progress',count(*) filter (where status='in_progress'),'completed',count(*) filter (where status='completed'))
      from public.parts_orders where parts_company_id=p_company),
    'revenueUSD', coalesce((select sum(case when oi.price_at_sale_currency='USD'
        then coalesce(oi.price_at_sale,0)*coalesce(oi.quantity,1)
        else (coalesce(oi.price_at_sale,0)*coalesce(oi.quantity,1))/nullif(coalesce(o.exchange_rate_at_sale,p_rate),0) end)
      from public.parts_orders o join public.parts_order_items oi on oi.order_id=o.id
      where o.parts_company_id=p_company and o.status='completed'),0),
    'customers', (select json_build_object('total',count(*),
        'withOrders',count(*) filter (where exists (select 1 from public.parts_orders po where po.customer_id=c.id)))
      from public.parts_customers c where c.parts_company_id=p_company),
    'marketOrders', (select count(*) from public.marketplace_orders where parts_company_id=p_company)
  );
$fn$;
grant execute on function public.get_parts_dashboard_stats(uuid, numeric) to authenticated;
