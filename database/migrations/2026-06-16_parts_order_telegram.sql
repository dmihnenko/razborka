-- Волна 5: Telegram-уведомление о НОВЫХ заказах кабинета.
-- По тому же паттерну, что notify_marketplace_order (waveE): БД-триггер → net.http_post
-- к Edge Function telegram-bot (режим внутренней отправки по x-internal-secret).
--
-- ⚠️ Применять ТОЛЬКО ПОСЛЕ:
--   1) telegram-bot задеплоена (supabase functions deploy telegram-bot)
--   2) задан секрет NOTIFY_SECRET (как в waveE) и pg_net включён
-- ⚠️ Перед запуском заменить __NOTIFY_SECRET__ на реальное значение секрета.
--
-- chat_id привязывается к компании ботом по ссылке t.me/<bot>?start=<company_id>
-- (см. docs/TELEGRAM-setup.md). Срабатывает и на ручные заказы, и на конвертацию
-- заявки с маркета в заказ.

create extension if not exists pg_net;

create or replace function public.notify_parts_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer text;
  v_text text;
begin
  select full_name into v_customer
    from public.parts_customers
   where id = NEW.customer_id;

  v_text := '🆕 <b>Новый заказ ' || coalesce(NEW.order_number, '') || '</b>' ||
            coalesce(E'\n👤 ' || v_customer, '');

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

drop trigger if exists trg_notify_parts_order on public.parts_orders;
create trigger trg_notify_parts_order
  after insert on public.parts_orders
  for each row execute function public.notify_parts_order();
