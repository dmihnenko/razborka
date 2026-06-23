-- Окупаемость авто (Vehicle ROI): одним RPC считаем по каждому купленному на разбор авто
-- сколько вложено (цена покупки авто), сколько вернулось проданными его запчастями
-- и сколько ещё «висит» непроданным остатком на складе.
--
-- ВАЖНО (бизнес-правило): б/у запчасти с разобранного авто НЕ имеют закупочной цены —
-- их себестоимость = цена самого авто. Поэтому «вложено» = ТОЛЬКО vehicle.purchase_price,
-- parts.purchase_price НЕ суммируем. Магазинные (новые) запчасти имеют vehicle_id = NULL
-- и в окупаемость авто не попадают (join по vehicle_id их отсекает).
--
-- Нормализация валют — в USD, как в get_parts_analytics (USD как есть; UAH / курс).
-- Курс продажи: exchange_rate_at_sale (зафиксирован при продаже) → vehicle.exchange_rate → p_rate.
-- Курс авто/остатка: vehicle.exchange_rate → p_rate.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh).
create or replace function public.get_vehicle_roi(p_company uuid, p_rate numeric default 41)
returns json language sql stable security invoker as $fn$
with v as (
  select id, make, model, year, status, purchase_price, purchase_date,
         coalesce(nullif(exchange_rate, 0), p_rate, 41) as vrate
  from public.parts_vehicles
  where parts_company_id = p_company
),
parts as (
  select i.vehicle_id, i.status, i.price_currency, i.selling_price, i.sold_price, i.quantity,
         coalesce(nullif(i.exchange_rate_at_sale, 0), vv.vrate) as srate,
         vv.vrate
  from public.parts_inventory i
  join v vv on vv.id = i.vehicle_id
  where i.parts_company_id = p_company
),
agg as (
  select vehicle_id,
    count(*)                                                    as parts_total,
    count(*) filter (where status = 'sold')                     as parts_sold,
    count(*) filter (where status in ('available', 'reserved')) as parts_in_stock,
    coalesce(sum(case when status = 'sold' then
        case when price_currency = 'USD'
             then coalesce(sold_price, selling_price, 0) * coalesce(quantity, 1)
             else coalesce(sold_price, selling_price, 0) * coalesce(quantity, 1) / srate end
      else 0 end), 0)                                           as realized_usd,
    coalesce(sum(case when status in ('available', 'reserved') then
        case when price_currency = 'USD'
             then coalesce(selling_price, 0) * coalesce(quantity, 1)
             else coalesce(selling_price, 0) * coalesce(quantity, 1) / vrate end
      else 0 end), 0)                                           as stock_usd
  from parts group by vehicle_id
)
select coalesce(json_agg(r order by r.profit_usd desc), '[]'::json)
from (
  select
    v.id                          as vehicle_id,
    v.make, v.model, v.year, v.status,
    v.purchase_price,
    v.purchase_date,
    case when coalesce(v.purchase_price, 0) > 0 then v.purchase_price / v.vrate end as investment_usd,
    coalesce(a.realized_usd, 0)   as realized_usd,
    coalesce(a.stock_usd, 0)      as stock_usd,
    coalesce(a.parts_total, 0)    as parts_total,
    coalesce(a.parts_sold, 0)     as parts_sold,
    coalesce(a.parts_in_stock, 0) as parts_in_stock,
    coalesce(a.realized_usd, 0)
      - case when coalesce(v.purchase_price, 0) > 0 then v.purchase_price / v.vrate else 0 end as profit_usd,
    case when coalesce(v.purchase_price, 0) > 0
         then round((coalesce(a.realized_usd, 0) / (v.purchase_price / v.vrate)) * 100) end    as payback_pct,
    coalesce(a.realized_usd, 0) + coalesce(a.stock_usd, 0)
      - case when coalesce(v.purchase_price, 0) > 0 then v.purchase_price / v.vrate else 0 end as forecast_usd
  from v left join agg a on a.vehicle_id = v.id
) r;
$fn$;

grant execute on function public.get_vehicle_roi(uuid, numeric) to authenticated;
