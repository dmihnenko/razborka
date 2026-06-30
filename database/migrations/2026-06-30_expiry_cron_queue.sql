-- ЭТАП 3. Крон истечения с возобновлением очереди.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-30.
--
-- Для каждой parts-компании, у которой активная подписка истекла (is_active, end_date<now):
--   1) текущую → status='ended', is_active=false.
--   2) взять СЛЕДУЮЩУЮ ожидающую (status in 'frozen','scheduled') ВЫСШЕГО уровня
--      (order by plan.sort_order desc, created_at asc, limit 1):
--        • frozen   → активировать, end = now + remaining_days дней (или бессрочно).
--        • scheduled→ активировать, end = now + sched_months мес.
--      + Telegram-уведомление владельцу о смене тарифа.
--   3) если ожидающих нет → назначить Демо бессрочно + уведомление про Демо (как раньше).
-- Не-parts (наследие STO) — просто деактивируем истёкшие.

create or replace function public.deactivate_expired_subscriptions()
returns void language plpgsql security definer set search_path = public as $fn$
declare
  demo_id  uuid;
  v_secret text;
  r        record;   -- истёкшая активная подписка компании
  q        record;   -- следующая в очереди
  v_text   text;
  v_plan   text;
  v_chat   bigint;
  v_company text;
begin
  select id into demo_id from public.subscriptions
    where company_type = 'parts' and is_demo and is_active order by created_at limit 1;
  v_secret := (select value from public.app_private where key = 'notify_secret');

  -- перебираем истёкшие активные parts-подписки
  for r in
    select cs.id, cs.company_id, c.name as company, c.telegram_chat_id
    from public.company_subscriptions cs
    join public.parts_companies c on c.id = cs.company_id
    where cs.company_type = 'parts' and cs.is_active
      and cs.end_date is not null and cs.end_date < now()
      and (demo_id is null or cs.subscription_id <> demo_id)
  loop
    v_company := coalesce(r.company, '');
    v_chat    := r.telegram_chat_id;

    -- 1) завершить истёкшую
    update public.company_subscriptions
      set is_active = false, status = 'ended', expiry_notified_at = null, updated_at = now()
      where id = r.id;

    -- 2) следующая в очереди (высший уровень → раньше созданная)
    select cs.id, cs.status, cs.remaining_days, cs.sched_months, cs.subscription_id,
           s.name as plan_name, (s.price = 0 or s.type = 'lifetime') as termless
      into q
    from public.company_subscriptions cs
    join public.subscriptions s on s.id = cs.subscription_id
    where cs.company_type = 'parts' and cs.company_id = r.company_id
      and cs.status in ('frozen','scheduled')
    order by coalesce(s.sort_order, 0) desc, cs.created_at asc
    limit 1;

    if found then
      -- активировать ожидающую
      update public.company_subscriptions
        set is_active = true, status = 'active', start_date = now(),
            end_date = case
              when q.termless then null
              when q.status = 'frozen' then
                case when q.remaining_days is null then null
                     else now() + make_interval(days => q.remaining_days) end
              else /* scheduled */ now() + make_interval(months => coalesce(q.sched_months, 1))
            end,
            remaining_days = null, sched_months = null,
            expiry_notified_at = null, updated_at = now()
        where id = q.id;
      v_plan := coalesce(q.plan_name, '');

      if v_chat is not null and v_secret is not null then
        v_text := '🔄 <b>Тариф переключён</b>' || E'\n' ||
                  '🏢 ' || v_company || E'\n' ||
                  '📦 Активен новый тариф: ' || v_plan || E'\n\n' ||
                  'Подробности в кабинете: razborka.net/parts/subscription';
        perform net.http_post(
          url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
          headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', v_secret),
          body    := jsonb_build_object('chat_id', v_chat, 'text', v_text));
      end if;

    elsif demo_id is not null then
      -- 3) ожидающих нет → Демо бессрочно
      insert into public.company_subscriptions
        (company_type, company_id, subscription_id, start_date, end_date, is_active, status)
      values ('parts', r.company_id, demo_id, now(), null, true, 'active');

      if v_chat is not null and v_secret is not null then
        v_text := '⛔ <b>Подписка закончилась</b>' || E'\n' ||
                  '🏢 ' || v_company || E'\n\n' ||
                  'Разборка переведена на бесплатный Демо-режим (50 запчастей / 3 авто / 2 сотрудника).' || E'\n' ||
                  'Оформите тариф, чтобы снять ограничения: razborka.net/parts/subscription';
        perform net.http_post(
          url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
          headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', v_secret),
          body    := jsonb_build_object('chat_id', v_chat, 'text', v_text));
      end if;
    end if;
  end loop;

  -- не-parts (наследие): просто деактивируем истёкшие
  update public.company_subscriptions set is_active = false, status = 'ended'
    where company_type <> 'parts' and is_active and end_date is not null and end_date < now();
end; $fn$;
