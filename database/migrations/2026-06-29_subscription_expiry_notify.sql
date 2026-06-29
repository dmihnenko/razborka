-- Уведомления владельцу об истечении подписки (Telegram).
-- 1) За ~3 дня до конца — напоминание продлить.
-- 2) В момент истечения (перевод на Демо) — сообщение, что включён Демо-режим.
-- Отправка как в notify_subscription_request: net.http_post → Edge telegram-bot,
-- x-internal-secret = app_private.notify_secret, body {chat_id, text}.
-- chat_id владельца = parts_companies.telegram_chat_id.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-29.

-- guard от повторной отправки в рамках одного периода подписки
alter table public.company_subscriptions
  add column if not exists expiry_notified_at timestamptz;

-- ── Напоминание за 3 дня ─────────────────────────────────────────────────────
create or replace function public.notify_expiring_subscriptions()
returns void language plpgsql security definer set search_path = public as $fn$
declare v_secret text; r record; v_days int; v_text text;
begin
  v_secret := (select value from public.app_private where key = 'notify_secret');
  if v_secret is null then return; end if;

  for r in
    select cs.id, cs.end_date, cs.start_date, c.name as company, c.telegram_chat_id, s.name as plan
    from public.company_subscriptions cs
    join public.parts_companies c on c.id = cs.company_id
    join public.subscriptions s on s.id = cs.subscription_id
    where cs.company_type = 'parts' and cs.is_active
      and cs.end_date is not null
      and cs.end_date > now() and cs.end_date <= now() + interval '3 days'
      and coalesce(s.is_demo, false) = false
      and c.telegram_chat_id is not null
      -- один раз за текущий период (start_date обновляется при назначении/продлении)
      and (cs.expiry_notified_at is null or cs.expiry_notified_at < cs.start_date)
  loop
    v_days := greatest(0, ceil(extract(epoch from (r.end_date - now())) / 86400)::int);
    v_text := '⏳ <b>Подписка скоро закончится</b>' || E'\n' ||
              '🏢 ' || coalesce(r.company, '') || E'\n' ||
              '📦 Тариф: ' || coalesce(r.plan, '') || E'\n' ||
              '🗓 Осталось дней: ' || v_days || E'\n\n' ||
              'Продлите, чтобы не потерять доступ: razborka.net/parts/subscription' || E'\n' ||
              'После окончания разборка перейдёт на бесплатный Демо-режим (50 запч / 3 авто).';
    perform net.http_post(
      url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body    := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', v_text));
    update public.company_subscriptions set expiry_notified_at = now() where id = r.id;
  end loop;
end; $fn$;

-- ── Истечение → Демо + уведомление ───────────────────────────────────────────
create or replace function public.deactivate_expired_subscriptions()
returns void language plpgsql security definer set search_path = public as $fn$
declare demo_id uuid; v_secret text; r record; v_text text;
begin
  select id into demo_id from public.subscriptions
    where company_type = 'parts' and is_demo and is_active order by created_at limit 1;
  v_secret := (select value from public.app_private where key = 'notify_secret');

  if demo_id is not null then
    for r in
      select cs.id, c.name as company, c.telegram_chat_id
      from public.company_subscriptions cs
      join public.parts_companies c on c.id = cs.company_id
      where cs.company_type = 'parts' and cs.is_active
        and cs.end_date is not null and cs.end_date < now()
        and cs.subscription_id <> demo_id
    loop
      update public.company_subscriptions
        set subscription_id = demo_id, start_date = now(), end_date = null,
            is_active = true, expiry_notified_at = null, updated_at = now()
        where id = r.id;
      if r.telegram_chat_id is not null and v_secret is not null then
        v_text := '⛔ <b>Подписка закончилась</b>' || E'\n' ||
                  '🏢 ' || coalesce(r.company, '') || E'\n\n' ||
                  'Разборка переведена на бесплатный Демо-режим (50 запчастей / 3 авто / 2 сотрудника).' || E'\n' ||
                  'Оформите тариф, чтобы снять ограничения: razborka.net/parts/subscription';
        perform net.http_post(
          url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
          body    := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', v_text));
      end if;
    end loop;
  else
    update public.company_subscriptions set is_active = false
      where company_type = 'parts' and is_active and end_date is not null and end_date < now();
  end if;

  update public.company_subscriptions set is_active = false
    where company_type <> 'parts' and is_active and end_date is not null and end_date < now();
end; $fn$;

-- ── Крон: напоминание ежедневно 09:00 UTC ────────────────────────────────────
do $do$ begin
  perform cron.unschedule('notify-expiring-subscriptions');
exception when others then null; end $do$;
select cron.schedule('notify-expiring-subscriptions', '0 9 * * *', $cron$select public.notify_expiring_subscriptions();$cron$);
