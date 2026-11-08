-- Общее хранилище фото razborka.net (R2) с лимитом по тарифу.
-- Идемпотентно. Применять ПЕРВЫМ (до деплоя клиента/воркера).
-- Следом, ПОСЛЕ деплоя клиента: 2026-11-05_z_revoke_photo_config.sql
-- ПЕРЕД деплоем воркера задать секрет (значение в миграции НЕ хранится):
--   insert into public.app_private(key, value) values ('photo_worker_secret', '<значение>')
--   on conflict (key) do update set value = excluded.value;
-- и то же значение: wrangler secret put PHOTO_WORKER_SECRET. Нет строки -> функции отказывают.

-- 1. Лимит в тарифе (МБ; NOT NULL, по умолчанию 100 — новый тариф безлимит не получает)
alter table public.subscriptions add column if not exists max_photo_storage_mb integer;

update public.subscriptions set max_photo_storage_mb = case lower(name)
    when 'демо' then 100
    when 'старт' then 1024
    when 'бизнес' then 2048
    when 'профи' then 5120
    when 'премиум' then 10240
  end
where max_photo_storage_mb is null and lower(name) in ('демо','старт','бизнес','профи','премиум');
update public.subscriptions set max_photo_storage_mb = 100 where max_photo_storage_mb is null;
alter table public.subscriptions alter column max_photo_storage_mb set default 100;
alter table public.subscriptions alter column max_photo_storage_mb set not null;

-- 2. Счётчик занятого места
create table if not exists public.parts_photo_usage (
  parts_company_id uuid primary key references public.parts_companies(id) on delete cascade,
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  updated_at timestamptz not null default now()
);
alter table public.parts_photo_usage enable row level security;
drop policy if exists parts_photo_usage_select on public.parts_photo_usage;
create policy parts_photo_usage_select on public.parts_photo_usage
  for select to authenticated using (public.is_my_parts_company(parts_company_id));
revoke all on public.parts_photo_usage from anon, authenticated, public;
grant select on public.parts_photo_usage to authenticated;

-- 3. Лимит компании в байтах (null = без лимита); нет активной подписки = как Демо (100 МБ)
create or replace function public._photo_limit_bytes(p_company uuid)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare lim integer;
begin
  select s.max_photo_storage_mb into lim
  from company_subscriptions cs
  join subscriptions s on s.id = cs.subscription_id
  where cs.company_id = p_company
    and cs.company_type = 'parts'
    and cs.is_active = true
    and (cs.end_date is null or cs.end_date >= now())
  order by cs.end_date desc nulls last
  limit 1;
  if not found then lim := 100; end if;
  if lim is null then return null; end if;
  return lim::bigint * 1024 * 1024;
end $$;
revoke all on function public._photo_limit_bytes(uuid) from public, anon, authenticated;

-- 4. Объекты общего хранилища (источник истины для квоты). Запись только через definer-функции.
drop function if exists public.reserve_photo_storage(bigint);
drop function if exists public.release_photo_storage(bigint);
create table if not exists public.parts_photo_objects (
  key text primary key,
  parts_company_id uuid not null references public.parts_companies(id) on delete cascade,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index if not exists parts_photo_objects_company_idx on public.parts_photo_objects(parts_company_id);
alter table public.parts_photo_objects enable row level security;
drop policy if exists parts_photo_objects_select on public.parts_photo_objects;
create policy parts_photo_objects_select on public.parts_photo_objects
  for select to authenticated using (public.is_my_parts_company(parts_company_id));
revoke all on public.parts_photo_objects from anon, authenticated, public;
grant select on public.parts_photo_objects to authenticated;

-- Проверка серверного секрета воркера (app_private, как notify_secret). Нет строки -> отказ.
create or replace function public._photo_check_secret(p_secret text)
returns void language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value into v from public.app_private where key = 'photo_worker_secret';
  if v is null or v = '' or p_secret is null or p_secret is distinct from v then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public._photo_check_secret(text) from public, anon, authenticated;

-- Регистрация объектов + проверка лимита, атомарно.
-- p_items: [{"key":"c/<company>/<id>/full.jpg","size":123}, ...]. Возвращает id компании.
create or replace function public.photo_register(p_secret text, p_user uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; pref text; lim bigint; cur bigint; total bigint := 0; it jsonb; k text; sz bigint; n int;
begin
  perform public._photo_check_secret(p_secret);
  select parts_company_id into cid from public.user_profiles where id = p_user;
  if cid is null then raise exception 'NO_COMPANY' using errcode = 'P0001'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'BAD_ITEMS' using errcode = 'P0001'; end if;
  n := jsonb_array_length(p_items);
  if n < 1 or n > 10 then raise exception 'BAD_ITEMS' using errcode = 'P0001'; end if;
  pref := 'c/' || cid::text || '/';
  for it in select * from jsonb_array_elements(p_items) loop
    k := it->>'key';
    sz := (it->>'size')::bigint;
    if k is null or left(k, length(pref)) <> pref then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
    if sz is null or sz < 1 or sz > 20 * 1024 * 1024 then raise exception 'BAD_SIZE' using errcode = 'P0001'; end if;
    total := total + sz;
  end loop;
  lim := public._photo_limit_bytes(cid);
  insert into public.parts_photo_usage (parts_company_id, used_bytes) values (cid, 0) on conflict do nothing;
  select used_bytes into cur from public.parts_photo_usage where parts_company_id = cid for update;
  if lim is not null and cur + total > lim then raise exception 'PHOTO_QUOTA_EXCEEDED' using errcode = 'P0001'; end if;
  insert into public.parts_photo_objects (key, parts_company_id, size_bytes)
    select e->>'key', cid, (e->>'size')::bigint from jsonb_array_elements(p_items) e;
  update public.parts_photo_usage set used_bytes = used_bytes + total, updated_at = now() where parts_company_id = cid;
  return cid;
end $$;

-- Снятие регистрации: удаляет только объекты компании пользователя, возвращает реально удалённые ключи.
create or replace function public.photo_unregister(p_secret text, p_user uuid, p_keys text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare cid uuid; ks text[]; freed bigint;
begin
  perform public._photo_check_secret(p_secret);
  select parts_company_id into cid from public.user_profiles where id = p_user;
  if cid is null then raise exception 'NO_COMPANY' using errcode = 'P0001'; end if;
  with d as (
    delete from public.parts_photo_objects where key = any(p_keys) and parts_company_id = cid
    returning key, size_bytes
  ) select coalesce(array_agg(key), '{}'), coalesce(sum(size_bytes), 0) into ks, freed from d;
  if freed > 0 then
    update public.parts_photo_usage set used_bytes = greatest(0, used_bytes - freed), updated_at = now()
     where parts_company_id = cid;
  end if;
  return ks;
end $$;

-- 5. Использование и лимит
create or replace function public.get_my_photo_usage()
returns json language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public.my_parts_company_id(); used bigint := 0;
begin
  if cid is null then return json_build_object('used_bytes', 0, 'limit_bytes', null); end if;
  select u.used_bytes into used from parts_photo_usage u where u.parts_company_id = cid;
  return json_build_object('used_bytes', coalesce(used, 0), 'limit_bytes', public._photo_limit_bytes(cid));
end $$;

-- 6. id компании текущего пользователя (для воркера, с токеном пользователя)
create or replace function public.get_my_parts_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select public.my_parts_company_id();
$$;

-- 7. Настройки хранилища фото (ключи) — отдельная таблица, не на parts_companies
create table if not exists public.parts_company_photo_settings (
  parts_company_id uuid primary key references public.parts_companies(id) on delete cascade,
  provider text,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.parts_company_photo_settings enable row level security;

-- Менять настройки может тот же, кто правит компанию (политика UPDATE parts_companies): parts_owner своей компании; плюс admin
create or replace function public._is_my_parts_owner(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select cid is not null and (
    public.is_admin()
    or exists (select 1 from public.user_profiles up
               join public.user_roles ur on ur.user_id = up.id
               join public.roles r on r.id = ur.role_id
               where up.id = auth.uid() and up.parts_company_id = cid and r.name = 'parts_owner')
  );
$$;
revoke all on function public._is_my_parts_owner(uuid) from public, anon;
grant execute on function public._is_my_parts_owner(uuid) to authenticated;

drop policy if exists photo_settings_select on public.parts_company_photo_settings;
drop policy if exists photo_settings_insert on public.parts_company_photo_settings;
drop policy if exists photo_settings_update on public.parts_company_photo_settings;
create policy photo_settings_select on public.parts_company_photo_settings
  for select to authenticated using (public.is_my_parts_company(parts_company_id));
create policy photo_settings_insert on public.parts_company_photo_settings
  for insert to authenticated with check (public._is_my_parts_owner(parts_company_id));
create policy photo_settings_update on public.parts_company_photo_settings
  for update to authenticated using (public._is_my_parts_owner(parts_company_id))
  with check (public._is_my_parts_owner(parts_company_id));
revoke all on public.parts_company_photo_settings from anon, authenticated, public;
grant select, insert, update on public.parts_company_photo_settings to authenticated;

-- Копия из прежних колонок (повторный запуск не затирает уже сохранённое)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'parts_companies' and column_name = 'photo_config') then
    execute 'insert into public.parts_company_photo_settings (parts_company_id, provider, config) '
         || 'select id, photo_provider, coalesce(photo_config, ''{}''::jsonb) from public.parts_companies '
         || 'on conflict (parts_company_id) do nothing';
  end if;
end $$;

create or replace function public.get_my_photo_storage()
returns json language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public.my_parts_company_id(); r record;
begin
  if cid is null then return null; end if;
  select provider, config into r from public.parts_company_photo_settings where parts_company_id = cid;
  if not found then return json_build_object('provider', 'shared', 'config', '{}'::jsonb); end if;
  return json_build_object('provider', coalesce(r.provider, 'shared'), 'config', coalesce(r.config, '{}'::jsonb));
end $$;

-- Сохранение: провайдер присваивается, config СЛИВАЕТСЯ (выбор shared не стирает ключи)
create or replace function public.save_my_photo_storage(p_provider text, p_config jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_parts_company_id();
begin
  if cid is null then raise exception 'NO_COMPANY' using errcode = 'P0001'; end if;
  if not public._is_my_parts_owner(cid) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_provider is null or p_provider not in ('shared','imgbb','cloudinary','freeimage') then
    raise exception 'BAD_PROVIDER' using errcode = 'P0001';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then p_config := '{}'::jsonb; end if;
  insert into public.parts_company_photo_settings as s (parts_company_id, provider, config, updated_at)
    values (cid, p_provider, p_config, now())
  on conflict (parts_company_id) do update
    set provider = excluded.provider, config = s.config || excluded.config, updated_at = now();
end $$;

-- 8. Права
do $$
declare f text;
begin
  foreach f in array array[
    'get_my_photo_usage()', 'get_my_parts_company_id()', 'get_my_photo_storage()',
    'save_my_photo_storage(text, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Воркер зовёт с anon-ключом; защита — серверный секрет внутри функций
revoke all on function public.photo_register(text, uuid, jsonb) from public;
revoke all on function public.photo_unregister(text, uuid, text[]) from public;
grant execute on function public.photo_register(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.photo_unregister(text, uuid, text[]) to anon, authenticated;

-- 9. Какие из URL фото ещё используются (защита от удаления файлов, на которые есть ссылки).
-- Смотрит товары компании (photos/photo_url) и снимки её корзины; admin — по всем компаниям.
-- Совпадение по тексту jsonb (url, medium_url, thumb_url); варианты razborka.net / www. равнозначны.
create or replace function public.photo_urls_in_use(p_urls text[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public.my_parts_company_id(); adm boolean := public.is_admin();
        res text[] := '{}'; u text; sub text; v text[]; hit boolean;
begin
  if cid is null and not adm then raise exception 'NO_COMPANY' using errcode = 'P0001'; end if;
  if p_urls is null then return res; end if;
  if coalesce(array_length(p_urls, 1), 0) > 300 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
  foreach u in array p_urls loop
    continue when u is null or u = '';
    v := array[u];
    if u ~ '^https://(www\.)?razborka\.net/' then
      sub := regexp_replace(u, '^https://(www\.)?razborka\.net/', '');
      v := array['https://razborka.net/' || sub, 'https://www.razborka.net/' || sub];
    end if;
    select exists (
      select 1 from public.parts_inventory i
      where (adm or i.parts_company_id = cid)
        and (i.photo_url = any(v) or exists (select 1 from unnest(v) x where strpos(i.photos::text, x) > 0))
    ) or exists (
      select 1 from public.trash_bin t
      where (adm or t.parts_company_id = cid)
        and exists (select 1 from unnest(v) x where strpos(t.entity_data::text, x) > 0)
    ) into hit;
    if hit then res := res || u; end if;
  end loop;
  return res;
end $$;
revoke all on function public.photo_urls_in_use(text[]) from public, anon;
grant execute on function public.photo_urls_in_use(text[]) to authenticated;

-- ПРОВЕРКА после применения:
--  select count(*) from parts_company_photo_settings;   -- = числу компаний
--  select proname from pg_proc where proname in ('reserve_photo_storage','release_photo_storage'); -- пусто
--  select key from app_private where key = 'photo_worker_secret';  -- 1 строка после задания секрета
--  select has_table_privilege('authenticated','public.parts_photo_objects','INSERT'); -- false
--  select count(*) from subscriptions where max_photo_storage_mb is null; -- 0
