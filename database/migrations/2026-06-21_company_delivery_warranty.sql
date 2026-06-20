-- Маркет: настройки доставки/гарантии разборки (показываются на странице товара).
-- ship_speed: 'today' (отправка сегодня) | 'days12' (отправка 1–2 дня).
-- warranty_enabled/warranty_days: продавец включает гарантию и задаёт дни (или выключает — не показывается).
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

alter table public.parts_companies
  add column if not exists ship_speed       text    not null default 'today',
  add column if not exists warranty_enabled boolean not null default true,
  add column if not exists warranty_days    int     not null default 14;

do $$ begin
  alter table public.parts_companies
    add constraint parts_companies_ship_speed_chk check (ship_speed in ('today', 'days12'));
exception when duplicate_object then null; end $$;
