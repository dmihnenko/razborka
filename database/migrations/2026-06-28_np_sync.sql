-- Авто-синк статусов Новой Почты. Ключ NP у каждой разборки свой (parts_np_settings.api_key).
-- Крон воркера (с CRON_RATE_SECRET) дёргает get_shipments_to_sync → бьёт НП ключом КАЖДОЙ
-- компании → apply_shipment_statuses пишет статусы и шлёт телеграм компании при доставке.

-- Посылки к опросу (не доставленные, давно не проверялись) + ключ NP их компании.
create or replace function public.get_shipments_to_sync(p_secret text)
returns table(id uuid, company_id uuid, ttn text, status_code text, api_key text)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_private where key = 'cron_rate_secret') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
  select s.id, s.parts_company_id, s.ttn, s.status_code, n.api_key
  from public.parts_shipments s
  join public.parts_np_settings n on n.parts_company_id = s.parts_company_id
  where s.ttn is not null
    and n.api_key is not null and n.api_key <> ''
    and (s.status_code is null or s.status_code not in ('9','10','11'))     -- ещё не доставлено
    and (s.last_checked_at is null or s.last_checked_at < now() - interval '20 minutes')
  limit 300;
end $$;
grant execute on function public.get_shipments_to_sync(text) to anon;

-- Применить статусы из НП: апдейт + телеграм компании при доставке (9/10/11).
create or replace function public.apply_shipment_statuses(p_secret text, p_updates jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare u jsonb; v_id uuid; v_status text; v_code text; v_old text; v_company uuid; v_ttn text; n int := 0;
begin
  if p_secret is null or p_secret <> (select value from public.app_private where key = 'cron_rate_secret') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  for u in select * from jsonb_array_elements(p_updates) loop
    v_id := (u->>'id')::uuid; v_status := u->>'status'; v_code := u->>'status_code';
    select status_code, parts_company_id, ttn into v_old, v_company, v_ttn from public.parts_shipments where id = v_id;
    if not found then continue; end if;
    update public.parts_shipments
       set status = v_status,
           status_code = v_code,
           status_updated_at = case when v_code is distinct from v_old then now() else status_updated_at end,
           last_checked_at = now()
     where id = v_id;
    n := n + 1;
    if v_code in ('9','10','11') and v_old is distinct from v_code then
      perform net.http_post(
        url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
        headers := jsonb_build_object('Content-Type','application/json',
                     'x-internal-secret', (select value from public.app_private where key='notify_secret')),
        body    := jsonb_build_object('company_id', v_company,
                     'text', '📦 <b>Посылка доставлена</b>' || E'\n' || 'ТТН ' || coalesce(v_ttn,'—') ||
                             coalesce(E'\n' || nullif(v_status,''), ''))
      );
    end if;
  end loop;
  return n;
end $$;
grant execute on function public.apply_shipment_statuses(text, jsonb) to anon;
