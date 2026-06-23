-- Telegram-уведомление о заказе кабинета шлём НЕ при создании, а когда заказ
-- СФОРМИРОВАН и ОТПРАВЛЕН — т.е. когда создана ТТН (np_ttn заполнен).
-- Так владелец получает готовый заказ под клиента с полными данными:
-- что и кто заказал, на какую сумму, контакты клиента и куда отправлено.
--
-- ⚠️ Применять после деплоя telegram-bot и с реальным NOTIFY_SECRET
-- (в SQL ниже __NOTIFY_SECRET__ заменяется на значение секрета при применении).
-- chat_id привязан к компании ботом (t.me/<bot>?start=<company_id>).

create extension if not exists pg_net;

create or replace function public.notify_parts_order_shipped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer text;
  v_phone    text;
  v_city     text;
  v_office   text;
  v_items    text;
  v_text     text;
begin
  -- Данные клиента
  select full_name, phone, city, np_office
    into v_customer, v_phone, v_city, v_office
    from public.parts_customers
   where id = NEW.customer_id;

  -- Что заказали: позиции «• Название ×кол-во — сумма валюта»
  select string_agg(
           '• ' || coalesce(i.name, '—') || ' ×' || coalesce(oi.quantity, 1) ||
           ' — ' || round(coalesce(oi.subtotal, 0)) || ' ' || coalesce(oi.price_at_sale_currency, 'UAH'),
           E'\n' order by oi.created_at
         )
    into v_items
    from public.parts_order_items oi
    left join public.parts_inventory i on i.id = oi.inventory_item_id
   where oi.order_id = NEW.id;

  v_text :=
    '📦 <b>Заказ ' || coalesce(NEW.order_number, '') || ' отправлен</b>' ||
    coalesce(E'\n👤 ' || v_customer, '') ||
    coalesce(E'\n📞 ' || v_phone, '') ||
    coalesce(E'\n\n' || v_items, '') ||
    coalesce(E'\n\n💰 Сумма: ' || round(coalesce(NEW.total_amount, 0)), '') ||
    coalesce(E'\n🚚 Куда: ' || v_city || coalesce(', ' || v_office, ''), '') ||
    coalesce(E'\n🧾 ТТН: ' || NEW.np_ttn, '');

  perform net.http_post(
    url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-internal-secret', '__NOTIFY_SECRET__'),
    body    := jsonb_build_object('company_id', NEW.parts_company_id, 'text', v_text)
  );
  return NEW;
end;
$$;

-- Старый триггер «при создании заказа» — убираем (спамил при создании пустого заказа)
drop trigger if exists trg_notify_parts_order on public.parts_orders;
drop function if exists public.notify_parts_order();

-- Новый триггер: срабатывает один раз, когда у заказа появляется ТТН
drop trigger if exists trg_notify_parts_order_shipped on public.parts_orders;
create trigger trg_notify_parts_order_shipped
  after update on public.parts_orders
  for each row
  when (NEW.np_ttn is not null and NEW.np_ttn <> '' and OLD.np_ttn is distinct from NEW.np_ttn)
  execute function public.notify_parts_order_shipped();
