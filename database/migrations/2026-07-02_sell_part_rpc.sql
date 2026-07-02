-- Атомарная продажа запчасти (2026-07-02).
-- Раньше SellPartModal делал 6 нетранзакционных запросов подряд (создать клиента →
-- заказ → позицию → total → completed → апдейт товара) — обрыв в середине оставлял
-- заказ-сироту/полузавершённое состояние. Теперь одна транзакция-RPC.
-- SECURITY INVOKER — RLS гарантирует, что владелец продаёт только свой товар.
-- Списание количества переиспользует триггер complete_parts_order (insert 'new' →
-- update 'completed'); sold_price/sold_at ставит триггер ТОЛЬКО при обнулении остатка
-- (корректно для частичной продажи многоштучного товара).
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh).

create or replace function public.sell_part(
  p_item_id uuid,
  p_price numeric,
  p_currency text,
  p_rate numeric default null,
  p_quantity int default 1,
  p_customer_id uuid default null,
  p_new_customer_name text default null,
  p_new_customer_phone text default null
) returns uuid
language plpgsql security invoker set search_path = public as $fn$
declare
  v_company uuid;
  v_qty int;
  v_status text;
  v_cust uuid := p_customer_id;
  v_order uuid;
  v_num text;
  v_left int;
begin
  if p_price is null or p_price < 0 then raise exception 'Некорректная цена'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'Некорректное количество'; end if;

  -- Товар (под RLS — только свой) + блокировка строки на время транзакции.
  select parts_company_id, quantity, status
    into v_company, v_qty, v_status
    from public.parts_inventory where id = p_item_id for update;
  if v_company is null then raise exception 'Товар не найден'; end if;
  if v_status is distinct from 'available' then raise exception 'Товар недоступен'; end if;
  if p_quantity > coalesce(v_qty, 0) then
    raise exception 'Недостаточно на складе (в наличии %)', coalesce(v_qty, 0) using errcode = 'P0001';
  end if;

  -- Новый клиент (опционально)
  if p_new_customer_name is not null and length(trim(p_new_customer_name)) > 0 then
    insert into public.parts_customers (parts_company_id, full_name, phone)
    values (v_company, trim(p_new_customer_name), nullif(trim(p_new_customer_phone), ''))
    returning id into v_cust;
  end if;

  v_num := public.generate_parts_order_number(v_company);

  insert into public.parts_orders (parts_company_id, customer_id, order_number, order_date, status, total_amount)
  values (v_company, v_cust, v_num, now(), 'new', 0)
  returning id into v_order;

  insert into public.parts_order_items (order_id, inventory_item_id, quantity, price_at_sale, price_at_sale_currency)
  values (v_order, p_item_id, p_quantity, p_price, p_currency);

  -- Завершаем заказ → триггер complete_parts_order спишет quantity и поставит sold при 0.
  update public.parts_orders
     set total_amount = p_price * p_quantity,
         exchange_rate_at_sale = p_rate,
         status = 'completed'
   where id = v_order;

  -- При полной продаже (остаток 0) привязываем покупателя к товару.
  select quantity into v_left from public.parts_inventory where id = p_item_id;
  if coalesce(v_left, 0) <= 0 and v_cust is not null then
    update public.parts_inventory set sold_to_customer_id = v_cust where id = p_item_id;
  end if;

  return v_order;
end;
$fn$;

grant execute on function public.sell_part(uuid, numeric, text, numeric, int, uuid, text, text) to authenticated;
