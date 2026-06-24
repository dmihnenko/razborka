-- Серверные счётчики для страницы «Запчасти»: needsFill (без цены/номера) и noPhoto (без фото).
-- Раньше needsFill на странице считался по ПОДГРУЖЕННОМУ срезу (пагинация) → недосчёт
-- (13 вместо 34). Дашборд считает серверно по ВСЕЙ выборке непроданных — здесь повторяем
-- ту же логику, чтобы числа совпадали, плюс новый noPhoto.
--   needsFill — непроданные без цены ИЛИ без оригинального номера;
--   noPhoto   — непроданные без фото (jsonb-массив photos пуст/отсутствует).

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
    'soldCount',      count(*) filter (where status='sold'),
    'needsFill', count(*) filter (where status<>'sold' and (
      selling_price is null or selling_price=0 or part_number is null or btrim(part_number)='')),
    'noPhoto', count(*) filter (where status<>'sold' and (
      photos is null or jsonb_typeof(photos)<>'array' or jsonb_array_length(photos)=0))
  )
  from public.parts_inventory where parts_company_id=p_company;
$fn$;
