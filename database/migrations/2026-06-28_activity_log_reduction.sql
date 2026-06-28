-- Журнал «уменьшение товара»: переориентация аудит-лога кабинета.
-- Раньше log_order_status_change писал ЛЮБУЮ смену статуса. Теперь журнал отслеживает
-- только то, что УМЕНЬШАЕТ товар:
--   • price_change      — изменение цены позиции (как было)
--   • order_closed      — заказ закрыт (completed → позиции списаны как продано)
--   • inventory_deleted — позиция склада удалена
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-28.

-- 1) Заказ: пишем запись ТОЛЬКО при закрытии (переход в completed), а не на каждый статус.
create or replace function public.log_order_status_change() returns trigger
language plpgsql security definer set search_path=public as $fn$
declare
  v_qty integer;
  v_sum numeric;
begin
  if TG_OP='UPDATE'
     and NEW.status = 'completed'
     and OLD.status is distinct from 'completed' then
    select coalesce(sum(quantity),0), coalesce(sum(subtotal),0)
      into v_qty, v_sum
      from public.parts_order_items where order_id = NEW.id;
    insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
    values (NEW.parts_company_id, auth.uid(), 'order', NEW.id, NEW.order_number, 'order_closed',
            'Заказ закрыт · продано позиций: ' || v_qty
            || ' · сумма: ' || trim(to_char(coalesce(NEW.total_amount, v_sum), 'FM999999990.00')) || ' ₴');
  end if;
  return NEW;
end; $fn$;
-- триггер уже навешан (trg_log_order_status) — переопределяем только функцию.

-- 2) Цена позиции — без изменений (оставляем существующий триггер trg_log_inventory_price).

-- 3) Удаление позиции склада → запись в журнал (ловит и точечное, и массовое удаление).
create or replace function public.log_inventory_delete() returns trigger
language plpgsql security definer set search_path=public as $fn$
begin
  insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
  values (OLD.parts_company_id, auth.uid(), 'inventory', OLD.id, OLD.name, 'inventory_deleted',
          'Удалена позиция склада'
          || case when OLD.selling_price is not null
                  then ' · цена: ' || trim(to_char(OLD.selling_price, 'FM999999990.00')) || ' ' || coalesce(OLD.price_currency,'')
                  else '' end
          || case when OLD.status is not null then ' · статус: ' || OLD.status else '' end);
  return OLD;
end; $fn$;
drop trigger if exists trg_log_inventory_delete on public.parts_inventory;
create trigger trg_log_inventory_delete after delete on public.parts_inventory
  for each row execute function public.log_inventory_delete();
