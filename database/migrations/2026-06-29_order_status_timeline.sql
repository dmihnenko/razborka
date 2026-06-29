-- Таймлайн заказа: вернуть логирование смен статуса.
-- После переделки журнала «уменьшение товара» (2026-06-28) триггер писал только order_closed,
-- из-за чего таймлайн на странице заказа (getEntityActivity 'order') показывал лишь закрытие.
-- Теперь: завершение → order_closed (его показывает журнал), ПРОЧИЕ переходы → status_change
-- (их журнал НЕ показывает — фильтр price_change/order_closed/inventory_deleted, см. PartsActivityLog),
-- но они нужны для истории заказа: кто и когда двигал new→Сборка→Отправлен.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-29.

-- Локализованный лейбл статуса (для читаемого detail в таймлайне)
create or replace function public.order_status_ru(s text)
returns text language sql immutable as $$
  select case s
    when 'new' then 'Новый'
    when 'assembling' then 'Сборка'
    when 'in_progress' then 'Сборка'
    when 'shipped' then 'Отправлен'
    when 'completed' then 'Завершён'
    when 'cancelled' then 'Отменён'
    else coalesce(s, '—')
  end;
$$;

create or replace function public.log_order_status_change() returns trigger
language plpgsql security definer set search_path=public as $fn$
declare
  v_qty integer;
  v_sum numeric;
begin
  if TG_OP='UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status = 'completed' then
      -- закрытие заказа (попадает в журнал «уменьшение товара»)
      select coalesce(sum(quantity),0), coalesce(sum(subtotal),0)
        into v_qty, v_sum
        from public.parts_order_items where order_id = NEW.id;
      insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
      values (NEW.parts_company_id, auth.uid(), 'order', NEW.id, NEW.order_number, 'order_closed',
              'Заказ закрыт · продано позиций: ' || v_qty
              || ' · сумма: ' || trim(to_char(coalesce(NEW.total_amount, v_sum), 'FM999999990.00')) || ' ₴');
    else
      -- прочие переходы — только для таймлайна заказа (журнал их не показывает)
      insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
      values (NEW.parts_company_id, auth.uid(), 'order', NEW.id, NEW.order_number, 'status_change',
              'Статус: ' || public.order_status_ru(OLD.status) || ' → ' || public.order_status_ru(NEW.status));
    end if;
  end if;
  return NEW;
end; $fn$;
-- триггер trg_log_order_status уже навешан на parts_orders — переопределяем только функцию.
