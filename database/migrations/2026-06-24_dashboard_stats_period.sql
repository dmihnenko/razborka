-- Дашборд (5b): период в агрегатах. Добавлен параметр p_period text default 'all'
-- ('today' | '7d' | 'month' | 'all'). Период скоупит revenueUSD и revenueOrders
-- (по o.created_at). Операционные метрики (vehicles/inventory/orders-funnel/customers/
-- marketOrders) остаются текущим состоянием. Backward-compatible: default 'all' = старое поведение.
--
-- Прибыль (выручка − себестоимость) НЕ добавлена осознанно: parts_inventory.purchase_price
-- (себестоимость запчасти) сейчас 0% заполнен — реальную прибыль посчитать нечем. Сначала нужно
-- завести захват себестоимости в форме добавления/продажи, затем добавить KPI.

create or replace function public.get_parts_dashboard_stats(p_company uuid, p_rate numeric default 41, p_period text default 'all')
returns json language sql stable as $fn$
  with b as (
    select case p_period
      when 'today' then date_trunc('day', now())
      when '7d'    then now() - interval '7 days'
      when 'month' then date_trunc('month', now())
      else null end as start
  )
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
      where o.parts_company_id=p_company and o.status='completed'
        and ((select start from b) is null or o.created_at >= (select start from b))),0),
    'revenueOrders', (select count(*) from public.parts_orders o
      where o.parts_company_id=p_company and o.status='completed'
        and ((select start from b) is null or o.created_at >= (select start from b))),
    'customers', (select json_build_object('total',count(*),
        'withOrders',count(*) filter (where exists (select 1 from public.parts_orders po where po.customer_id=c.id)))
      from public.parts_customers c where c.parts_company_id=p_company),
    'marketOrders', (select count(*) from public.marketplace_orders where parts_company_id=p_company)
  );
$fn$;
