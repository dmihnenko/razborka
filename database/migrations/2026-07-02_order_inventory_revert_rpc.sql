-- Целостность склада при удалении/отмене заказа (2026-07-02).
-- Баг: complete_parts_order при завершении вычитает quantity, но удаление/отмена
-- завершённого заказа возвращали только status='available' БЕЗ восстановления quantity
-- → тихая потеря остатков и «зомби»-товар с quantity=0.
-- Фикс: две атомарные RPC (одна функция = одна транзакция), симметричные списанию.
-- SECURITY INVOKER — RLS гарантирует, что владелец трогает только свои данные
-- (чужой заказ → SELECT вернёт null, UPDATE/DELETE затронут 0 строк).
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh).

-- Возврат остатков по позициям завершённого заказа (зеркально complete_parts_order):
--   quantity += проданное; sold→available; очистка sold_*.
create or replace function public._revert_order_inventory(p_order_id uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
declare
  v_status text;
begin
  select status into v_status from public.parts_orders where id = p_order_id;
  if v_status is null then
    return; -- не наш заказ (RLS) или не существует
  end if;

  if v_status = 'completed' then
    -- вернуть проданное количество
    update public.parts_inventory pi
    set quantity            = pi.quantity + poi.quantity,
        status              = case when pi.status = 'sold' then 'available' else pi.status end,
        sold_price          = case when pi.status = 'sold' then null else pi.sold_price end,
        sold_at             = case when pi.status = 'sold' then null else pi.sold_at end,
        sold_to_customer_id = case when pi.status = 'sold' then null else pi.sold_to_customer_id end
    from public.parts_order_items poi
    where poi.order_id = p_order_id
      and pi.id = poi.inventory_item_id
      and poi.inventory_item_id is not null;
  else
    -- незавершённый: просто снять резерв
    update public.parts_inventory pi
    set status = 'available'
    from public.parts_order_items poi
    where poi.order_id = p_order_id
      and pi.id = poi.inventory_item_id
      and poi.inventory_item_id is not null
      and pi.status = 'reserved';
  end if;
end;
$fn$;

-- Атомарное удаление заказа с корректным возвратом склада.
create or replace function public.delete_parts_order(p_order_id uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
begin
  perform public._revert_order_inventory(p_order_id);
  delete from public.parts_order_items where order_id = p_order_id;
  delete from public.parts_orders where id = p_order_id;
end;
$fn$;

-- Атомарная отмена заказа с корректным возвратом склада.
create or replace function public.cancel_parts_order(p_order_id uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
begin
  perform public._revert_order_inventory(p_order_id);
  update public.parts_orders set status = 'cancelled' where id = p_order_id;
end;
$fn$;

-- Повторное списание при восстановлении завершённого заказа из корзины
-- (зеркально complete_parts_order): т.к. delete_parts_order уже вернул остатки,
-- восстановление completed-заказа должно списать их заново — иначе over-кредит.
create or replace function public.reapply_order_inventory(p_order_id uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
declare
  v_status text;
begin
  select status into v_status from public.parts_orders where id = p_order_id;
  if v_status is null or v_status <> 'completed' then
    return;
  end if;
  update public.parts_inventory pi
  set quantity   = greatest(0, pi.quantity - poi.quantity),
      status     = case when pi.quantity - poi.quantity <= 0 then 'sold' else pi.status end,
      sold_price = case when pi.quantity - poi.quantity <= 0 then coalesce(pi.sold_price, poi.price_at_sale) else pi.sold_price end,
      sold_at    = case when pi.quantity - poi.quantity <= 0 then coalesce(pi.sold_at, now()) else pi.sold_at end
  from public.parts_order_items poi
  where poi.order_id = p_order_id
    and pi.id = poi.inventory_item_id
    and poi.inventory_item_id is not null;
end;
$fn$;

grant execute on function public.delete_parts_order(uuid) to authenticated;
grant execute on function public.cancel_parts_order(uuid) to authenticated;
grant execute on function public.reapply_order_inventory(uuid) to authenticated;
