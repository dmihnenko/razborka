-- Фикс подсчёта «склад / продано» на странице «Запчасти».
-- Было: суммы считались на клиенте по подгруженным страницам (infinite scroll) → неполный итог;
-- «продано» умножалось на ОСТАТОК quantity (после продажи часто 0) вместо проданного sold_quantity.
-- Стало: серверный агрегат по ВСЕЙ выборке компании (RLS изолирует по тенанту).
--   stockUSD — стоимость наличия+резерва (selling_price × quantity), UAH→USD по текущему курсу;
--   soldUSD  — выручка продаж (coalesce(sold_price,selling_price) × sold_quantity), UAH→USD по
--              зафиксированному на продаже курсу (exchange_rate_at_sale), иначе текущему.

create or replace function public.get_parts_inventory_summary(p_company uuid, p_rate numeric default 41)
returns json language sql stable as $fn$
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
    'soldCount',      count(*) filter (where status='sold')
  )
  from public.parts_inventory where parts_company_id=p_company;
$fn$;
