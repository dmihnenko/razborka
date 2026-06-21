-- Заявка с маркета не приходила в Telegram: триггер notify_company_on_market_order
-- слал ТОЛЬКО in-app уведомление, без net.http_post в telegram-bot.
-- Добавляем отправку в Telegram (как в notify_parts_order), сохраняя in-app.
create or replace function public.notify_company_on_market_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_text text;
begin
  -- 1) In-app уведомление владельцам разборки
  insert into public.notifications (user_id, type, title, body, link, read)
  select up.id, 'info', 'Новая заявка с маркета',
         'Телефон: ' || coalesce(NEW.buyer_phone,'—') || coalesce(' · ' || NEW.buyer_name, ''),
         '/parts/market-orders', false
  from public.user_profiles up
  join public.user_roles ur on ur.user_id = up.id
  join public.roles r on r.id = ur.role_id
  where up.parts_company_id = NEW.parts_company_id and r.name = 'parts_owner';

  -- 2) Telegram (если у компании привязан бот — функция сама проверит chat_id)
  v_text := '🛒 <b>Новая заявка с маркета</b>' || E'\n' ||
            '📞 ' || coalesce(NEW.buyer_phone, '—') ||
            coalesce(E'\n👤 ' || NEW.buyer_name, '') ||
            coalesce(E'\n💬 ' || NEW.comment, '') ||
            coalesce(E'\n💰 Сумма: ' || NEW.total_amount::text, '');

  perform net.http_post(
    url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-internal-secret', 'de788aa221ec499a9307fd41c24d8b462c943e96cda74aa79592091e7a13dd14'),
    body    := jsonb_build_object('company_id', NEW.parts_company_id, 'text', v_text)
  );
  return NEW;
end;
$function$;
