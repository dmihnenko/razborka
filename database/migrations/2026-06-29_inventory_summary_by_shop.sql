-- Сводка склада по вкладке (разборка vs магазин).
-- Раньше get_parts_inventory_summary считал по ВСЕЙ компании, из-за чего во вкладке
-- «Магазин» показывались разборочные позиции (напр. «34 запчастей без цены или номера»),
-- хотя магазин и разборка не пересекаются. Добавляем параметр p_is_shop:
--   null  → как раньше (вся компания),
--   false → только разборка (is_shop=false),
--   true  → только магазин (is_shop=true).
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-29.

create or replace function public.get_parts_inventory_summary(
  p_company uuid, p_rate numeric default 41, p_is_shop boolean default null
)
returns json language sql stable as $function$
  select json_build_object(
    'stockUSD', coalesce(sum(
      case when price_currency='UAH'
        then coalesce(selling_price,0)*coalesce(quantity,0)/nullif(p_rate,0)
        else coalesce(selling_price,0)*coalesce(quantity,0) end
    ) filter (where status in ('available','reserved')), 0),
    'soldUSD', coalesce(sum(
      case when price_currency='UAH'
        then coalesce(sold_price,selling_price,0)*coalesce(nullif(sold_quantity,0),1)/nullif(coalesce(exchange_rate_at_sale,p_rate),0)
        else coalesce(sold_price,selling_price,0)*coalesce(nullif(sold_quantity,0),1) end
    ) filter (where status='sold'), 0),
    'availableCount', count(*) filter (where status='available'),
    'reservedCount',  count(*) filter (where status='reserved'),
    'soldCount',      count(*) filter (where status='sold'),
    'needsFill', count(*) filter (where status<>'sold' and (
      selling_price is null or selling_price=0 or part_number is null or btrim(part_number)='')),
    'noPhoto', count(*) filter (where status<>'sold' and (
      photos is null or jsonb_typeof(photos)<>'array' or jsonb_array_length(photos)=0))
  )
  from public.parts_inventory
  where parts_company_id = p_company
    and (p_is_shop is null or is_shop = p_is_shop);
$function$;
