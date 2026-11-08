-- Лимит фото по количеству (видит владелец) + скрытый потолок в МБ (страховка).
-- Расчёт: 10 ГБ бесплатного R2 на ~20 разборок = ~500 МБ на разборку на максимальном тарифе.
-- Одно фото = 3 файла (full/medium/thumb), после сжатия ~230 КБ, потолок ~300 КБ.
-- Идемпотентна.

-- 1. Лимит количества фото в тарифе (null = без лимита)
alter table public.subscriptions add column if not exists max_photos integer;
alter table public.subscriptions alter column max_photos set default 100;

update public.subscriptions set max_photos = 100,  max_photo_storage_mb = 30  where name = 'Демо';
update public.subscriptions set max_photos = 500,  max_photo_storage_mb = 150 where name = 'Старт';
update public.subscriptions set max_photos = 1000, max_photo_storage_mb = 300 where name = 'Бизнес';
update public.subscriptions set max_photos = 2000, max_photo_storage_mb = 600 where name = 'Профи';
-- Премиум — внутренний тариф: без лимита по количеству, место как было
update public.subscriptions set max_photos = null where name = 'Премиум';
-- Старые платные тарифы (на них ещё сидят клиенты, напр. бессрочный) — уровень Профи
update public.subscriptions set max_photos = 2000, max_photo_storage_mb = 600
 where coalesce(is_active, false) = false and name not in ('Демо', 'Старт', 'Бизнес', 'Профи', 'Премиум');

-- 2. Лимит количества фото компании (null = без лимита); нет активной подписки = как Демо
create or replace function public._photo_limit_count(p_company uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare lim integer; found_sub boolean := false;
begin
  select s.max_photos, true into lim, found_sub
  from company_subscriptions cs
  join subscriptions s on s.id = cs.subscription_id
  where cs.company_id = p_company
    and cs.company_type = 'parts'
    and cs.is_active = true
    and (cs.end_date is null or cs.end_date >= now())
  order by cs.end_date desc nulls last
  limit 1;
  if not coalesce(found_sub, false) then return 100; end if;
  return lim;
end $$;
revoke all on function public._photo_limit_count(uuid) from public, anon, authenticated;

-- Нет активной подписки = как Демо (30 МБ)
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
  if not found then lim := 30; end if;
  if lim is null then return null; end if;
  return lim::bigint * 1024 * 1024;
end $$;
revoke all on function public._photo_limit_bytes(uuid) from public, anon, authenticated;

-- Одно фото = объект full.*
create or replace function public._photo_count(p_company uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.parts_photo_objects
   where parts_company_id = p_company and key ~ '/full\.(jpg|webp)$';
$$;
revoke all on function public._photo_count(uuid) from public, anon, authenticated;

-- 3. Регистрация: проверка и количества, и места — атомарно (блокировка строки счётчика)
create or replace function public.photo_register(p_secret text, p_user uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; pref text; lim bigint; lim_n integer; cur bigint; total bigint := 0; new_n int := 0;
        it jsonb; k text; sz bigint; n int;
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
    if k ~ '/full\.(jpg|webp)$' then new_n := new_n + 1; end if;
  end loop;
  lim := public._photo_limit_bytes(cid);
  lim_n := public._photo_limit_count(cid);
  insert into public.parts_photo_usage (parts_company_id, used_bytes) values (cid, 0) on conflict do nothing;
  select used_bytes into cur from public.parts_photo_usage where parts_company_id = cid for update;
  if lim_n is not null and public._photo_count(cid) + new_n > lim_n then
    raise exception 'PHOTO_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  if lim is not null and cur + total > lim then raise exception 'PHOTO_QUOTA_EXCEEDED' using errcode = 'P0001'; end if;
  insert into public.parts_photo_objects (key, parts_company_id, size_bytes)
    select e->>'key', cid, (e->>'size')::bigint from jsonb_array_elements(p_items) e;
  update public.parts_photo_usage set used_bytes = used_bytes + total, updated_at = now() where parts_company_id = cid;
  return cid;
end $$;

-- 4. Использование: байты (служебно) + количество фото (видит владелец)
create or replace function public.get_my_photo_usage()
returns json language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public.my_parts_company_id(); used bigint := 0;
begin
  if cid is null then
    return json_build_object('used_bytes', 0, 'limit_bytes', null, 'used_photos', 0, 'limit_photos', null);
  end if;
  select u.used_bytes into used from parts_photo_usage u where u.parts_company_id = cid;
  return json_build_object(
    'used_bytes', coalesce(used, 0),
    'limit_bytes', public._photo_limit_bytes(cid),
    'used_photos', public._photo_count(cid),
    'limit_photos', public._photo_limit_count(cid));
end $$;
