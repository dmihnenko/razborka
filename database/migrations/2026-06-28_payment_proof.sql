-- Связь с клиентом по оплате: клиент прикладывает скрин оплаты к своей заявке,
-- админ получает уведомление со скрином и подтверждает в админке.
alter table public.subscription_requests add column if not exists payment_proof_url text;
alter table public.subscription_requests add column if not exists client_note text;

-- Клиент (владелец компании заявки) прикладывает скрин + сообщение. SECURITY DEFINER:
-- проверяет владение, обновляет заявку и шлёт админу telegram со ссылкой на скрин.
create or replace function public.submit_payment_proof(p_request_id uuid, p_url text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_req public.subscription_requests%rowtype;
  v_company text; v_company_phone text; v_owner text; v_phone text; v_chat text; v_text text;
begin
  select * into v_req from public.subscription_requests where id = p_request_id;
  if not found then raise exception 'not found' using errcode = 'P0001'; end if;
  if not (public.is_admin() or v_req.company_id = public.my_parts_company_id()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.subscription_requests
     set payment_proof_url = p_url, client_note = nullif(trim(p_note), '')
   where id = p_request_id;

  select name, phone into v_company, v_company_phone from public.parts_companies where id = v_req.company_id;
  select full_name, phone into v_owner, v_phone from public.user_profiles where id = auth.uid();
  v_chat := (select value from public.app_private where key = 'admin_telegram_chat_id');
  if v_chat is not null then
    v_text := '💳 <b>Клиент приложил оплату подписки</b>' || E'\n' ||
              '🏢 ' || coalesce(v_company, '—') ||
              coalesce(E'\n👤 ' || nullif(v_owner, ''), '') ||
              coalesce(E'\n📞 ' || coalesce(nullif(v_phone, ''), nullif(v_company_phone, '')), '') ||
              coalesce(E'\n💬 ' || nullif(trim(p_note), ''), '') || E'\n' ||
              '🧾 Скрин: ' || coalesce(p_url, '—') || E'\n' ||
              'Подтвердить: razborka.net/admin/subscriptions';
    perform net.http_post(
      url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-internal-secret', (select value from public.app_private where key = 'notify_secret')),
      body    := jsonb_build_object('chat_id', v_chat, 'text', v_text)
    );
  end if;
end $$;
grant execute on function public.submit_payment_proof(uuid, text, text) to authenticated;
