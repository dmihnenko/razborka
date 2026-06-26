-- Глобальный курс USD (один на всю платформу), обновляется кроном раз в сутки.
-- Анти-спам: ПриватБанк дёргает ТОЛЬКО крон (1×/сутки), пользователи лишь читают app_settings.
-- Курс хранится в app_settings (key='usd_rate', публичное чтение).
-- Запись — через scoped-RPC с секретом (в приватной таблице) — БЕЗ service-role в Cloudflare.

-- Приватная таблица секретов: RLS включён, политик НЕТ → недоступна anon/authenticated.
-- Читает её только SECURITY DEFINER-функция (как owner, в обход RLS).
create table if not exists public.app_private (
  key   text primary key,
  value text not null
);
alter table public.app_private enable row level security;
revoke all on table public.app_private from anon, authenticated;

-- Установить глобальный курс. Вызывает крон (anon + секрет). Секрет сверяется с app_private.
create or replace function public.set_global_usd_rate(p_rate numeric, p_source text, p_secret text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_secret text;
begin
  select value into v_secret from public.app_private where key = 'cron_rate_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'forbidden';
  end if;
  if p_rate is null or p_rate <= 0 or p_rate > 1000 then
    raise exception 'invalid rate';
  end if;
  insert into public.app_settings (key, value, updated_at)
  values ('usd_rate', json_build_object('rate', p_rate, 'date', current_date, 'source', coalesce(nullif(p_source,''),'privatbank'))::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
revoke all on function public.set_global_usd_rate(numeric, text, text) from public;
grant execute on function public.set_global_usd_rate(numeric, text, text) to anon, authenticated;
