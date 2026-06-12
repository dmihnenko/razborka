-- Волна E: Telegram-уведомления (триггер на заявки + крон на истечение подписки).
--
-- ⚠️ ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ ТОГО, КАК:
--   1) Edge Function `telegram-bot` задеплоена (supabase functions deploy telegram-bot)
--   2) заданы секреты функции: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NOTIFY_SECRET
--   3) включено расширение pg_net (см. ниже)
--
-- ⚠️ Перед запуском ЗАМЕНИТЬ плейсхолдеры:
--   __NOTIFY_SECRET__  — то же значение, что секрет NOTIFY_SECRET у функции
--   (URL функции уже подставлен для ref hwckvddevjucuzxdoqqh)
--
-- Секрет в открытом виде в этом файле НЕ хранить — подставлять при ручном запуске.

-- 0) Расширения
create extension if not exists pg_net;
-- pg_cron уже включён (1.6.4)

-- 1) Уведомление о новой заявке с маркета ────────────────────────────────────
create or replace function public.notify_marketplace_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text;
begin
  v_text := '🛒 <b>Новая заявка с маркета</b>' || E'\n' ||
            '📞 ' || coalesce(NEW.buyer_phone, '—') ||
            coalesce(E'\n👤 ' || NEW.buyer_name, '') ||
            coalesce(E'\n💬 ' || NEW.comment, '') ||
            E'\n💰 Сумма: ' || coalesce(NEW.total_amount::text, '0');

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

drop trigger if exists trg_notify_marketplace_order on public.marketplace_orders;
create trigger trg_notify_marketplace_order
  after insert on public.marketplace_orders
  for each row execute function public.notify_marketplace_order();

-- 2) Напоминание об истечении подписки (за 3 дня) + автодеактивация истёкших ──
create or replace function public.notify_expiring_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- за 3 дня до конца — напоминание
  perform net.http_post(
    url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-internal-secret', '__NOTIFY_SECRET__'),
    body    := jsonb_build_object(
                 'company_id', cs.company_id,
                 'text', '⏳ <b>Подписка заканчивается через 3 дня</b>' || E'\n' ||
                         'Продлите доступ, чтобы не потерять витрину и приём заявок.')
  )
  from public.company_subscriptions cs
  where cs.company_type = 'parts'
    and cs.is_active = true
    and cs.end_date is not null
    and cs.end_date::date = (now() + interval '3 days')::date;

  -- истёкшие — деактивируем
  update public.company_subscriptions
     set is_active = false
   where company_type = 'parts'
     and is_active = true
     and end_date is not null
     and end_date < now();
end;
$$;

-- ежедневно в 09:00 (UTC) — пересоздаём задачу идемпотентно
select cron.unschedule('notify-subscription-expiry')
  where exists (select 1 from cron.job where jobname = 'notify-subscription-expiry');
select cron.schedule('notify-subscription-expiry', '0 9 * * *',
  $$ select public.notify_expiring_subscriptions(); $$);
