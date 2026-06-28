-- Полное telegram-уведомление админу о новой заявке на подписку (раньше приходило
-- генерик «проверьте в админке» без деталей). Шлём: компания, тариф, срок, сумма,
-- контакты владельца (имя + телефон). Адрес — чат админа из app_private.

-- Чат платформенного админа (по умолчанию — текущий админ; меняется при необходимости)
insert into public.app_private(key, value)
values ('admin_telegram_chat_id', '123867517')
on conflict (key) do nothing;

create or replace function public.notify_subscription_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company text; v_company_phone text;
  v_plan public.subscriptions%rowtype;
  v_owner_name text; v_owner_phone text;
  v_amount numeric; v_chat text; v_text text; v_phone text;
begin
  select name, phone into v_company, v_company_phone from public.parts_companies where id = NEW.company_id;
  select * into v_plan from public.subscriptions where id = NEW.plan_id;
  select full_name, phone into v_owner_name, v_owner_phone from public.user_profiles where id = NEW.requested_by;
  v_amount := public.calc_sub_amount(coalesce(v_plan.price, 0), NEW.months);
  v_chat := (select value from public.app_private where key = 'admin_telegram_chat_id');
  if v_chat is null then return NEW; end if;
  v_phone := coalesce(nullif(v_owner_phone, ''), nullif(v_company_phone, ''));

  v_text := '🧾 <b>Новая заявка на подписку</b>' || E'\n' ||
            '🏢 ' || coalesce(v_company, '—') || E'\n' ||
            '📦 Тариф: ' || coalesce(v_plan.name, '—') || E'\n' ||
            '🗓 Срок: ' || NEW.months || ' мес' || E'\n' ||
            '💰 Сумма: ' || to_char(round(v_amount), 'FM999999990') || ' грн' ||
            coalesce(E'\n👤 ' || nullif(v_owner_name, ''), '') ||
            coalesce(E'\n📞 ' || v_phone, '') ||
            coalesce(E'\n💬 ' || nullif(NEW.note, ''), '') || E'\n\n' ||
            'Открыть: razborka.net/admin/subscriptions';

  perform net.http_post(
    url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-internal-secret', (select value from public.app_private where key = 'notify_secret')),
    body    := jsonb_build_object('chat_id', v_chat, 'text', v_text)
  );
  return NEW;
end $$;

drop trigger if exists trg_notify_subscription_request on public.subscription_requests;
create trigger trg_notify_subscription_request
  after insert on public.subscription_requests
  for each row execute function public.notify_subscription_request();
