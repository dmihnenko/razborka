-- Кабинет клиента: (1) уведомление покупателю о смене статуса заказа; (2) отмена заявки клиентом.

-- ── (1) Триггер: смена статуса заказа разборкой → уведомление покупателю ──
create or replace function public.notify_buyer_market_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_label text;
begin
  -- только при реальной смене статуса, для залогиненного покупателя, и НЕ на отмену
  -- (отмену инициирует сам покупатель — его уведомлять не нужно)
  if NEW.status is distinct from OLD.status and NEW.user_id is not null and NEW.status <> 'cancelled' then
    v_label := case NEW.status
      when 'new' then 'Новый'
      when 'viewed' then 'Принят в работу'
      when 'closed' then 'Завершён'
      else NEW.status end;
    insert into public.notifications (user_id, type, title, body, link, read)
    values (NEW.user_id, 'order_status', 'Статус заказа обновлён',
            'Ваш заказ с маркета: ' || v_label, '/my-orders', false);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_buyer_market_status on public.marketplace_orders;
create trigger trg_notify_buyer_market_status
  after update on public.marketplace_orders
  for each row execute function public.notify_buyer_market_status();

-- ── (2) Отмена заявки покупателем (SECURITY DEFINER — обходит company-only UPDATE-политику) ──
create or replace function public.cancel_my_marketplace_order(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select parts_company_id into v_company
    from public.marketplace_orders where id = p_id and user_id = v_uid;
  if not found then raise exception 'Заявка не найдена'; end if;

  update public.marketplace_orders set status = 'cancelled'
   where id = p_id and user_id = v_uid and status in ('new','viewed');
  if not found then raise exception 'Эту заявку уже нельзя отменить'; end if;

  -- уведомить команду разборки
  insert into public.notifications (user_id, type, title, body, link, read)
  select up.id, 'order_cancelled', 'Заявка отменена покупателем',
         'Покупатель отменил заявку с маркета', '/parts/market-orders', false
  from public.user_profiles up
  where up.parts_company_id = v_company and up.is_active;
end;
$$;
revoke all on function public.cancel_my_marketplace_order(uuid) from public;
grant execute on function public.cancel_my_marketplace_order(uuid) to authenticated;
