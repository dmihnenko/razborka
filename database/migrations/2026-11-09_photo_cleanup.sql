-- Регулярная уборка общего хранилища фото (R2): осиротевшие файлы не держат место и квоту.
-- Идемпотентна. Секрет — тот же photo_worker_secret (app_private), проверка _photo_check_secret.
-- Воркер зовёт RPC с anon-ключом (как photo_register), поэтому EXECUTE выдан anon/authenticated;
-- защита — серверный секрет внутри каждой функции. От public права отозваны.
--
-- Источники ссылок на фото (ищем «razborka.net/photos/c/<company>/<uuid>/» в тексте строк):
--   parts_inventory (photos, photo_url), parts_vehicles (photos, photo_url),
--   trash_bin (entity_data — снимки удалённых: файлы из корзины ИСПОЛЬЗУЕМЫ),
--   marketplace_order_items / marketplace_orders (photo_url снимков заказов),
--   personal_vehicles, parts_companies (на случай логотипов/фото).
-- Таблицы, которых нет в базе, пропускаются (to_regclass). Сверяем по ПАПКЕ фото c/<company>/<uuid>/,
-- т.е. если где-то осталась ссылка хотя бы на один из вариантов (full/medium/thumb) — все три живут.

-- Все папки фото, на которые есть ссылки (c/<company>/<uuid>/)
create or replace function public._photo_referenced_dirs()
returns setof text language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  foreach t in array array[
    'parts_inventory', 'parts_vehicles', 'trash_bin',
    'marketplace_order_items', 'marketplace_orders', 'personal_vehicles', 'parts_companies'
  ] loop
    continue when to_regclass('public.' || t) is null;
    return query execute format(
      $q$ select distinct m[1] from public.%I x,
            regexp_matches(x::text, 'razborka\.net/photos/(c/[A-Za-z0-9-]+/[A-Za-z0-9-]+/)', 'g') as m $q$, t);
  end loop;
end $$;
revoke all on function public._photo_referenced_dirs() from public, anon, authenticated;

-- Сироты: объекты старше p_min_age без ссылок
create or replace function public.photo_orphans(p_secret text, p_min_age interval default '3 days', p_limit int default 500)
returns table(key text, parts_company_id uuid, size_bytes bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform public._photo_check_secret(p_secret);
  return query
    with referenced as (select d from public._photo_referenced_dirs() d)
    select o.key, o.parts_company_id, o.size_bytes
      from public.parts_photo_objects o
     where o.created_at < now() - p_min_age
       and not exists (select 1 from referenced r where r.d = regexp_replace(o.key, '[^/]+$', ''))
     order by o.created_at
     limit greatest(1, least(coalesce(p_limit, 500), 2000));
end $$;

-- Снять регистрацию сирот (повторная проверка внутри) и пересчитать used_bytes компаний
create or replace function public.photo_purge(p_secret text, p_keys text[])
returns int language plpgsql security definer set search_path = public as $$
declare n int; cids uuid[];
begin
  perform public._photo_check_secret(p_secret);
  if p_keys is null or coalesce(array_length(p_keys, 1), 0) = 0 then return 0; end if;
  with referenced as (select d from public._photo_referenced_dirs() d),
  del as (
    delete from public.parts_photo_objects o
     where o.key = any(p_keys)
       and o.created_at < now() - interval '3 days'
       and not exists (select 1 from referenced r where r.d = regexp_replace(o.key, '[^/]+$', ''))
    returning o.parts_company_id
  ) select count(*)::int, coalesce(array_agg(distinct parts_company_id), '{}') into n, cids from del;
  if n > 0 then
    insert into public.parts_photo_usage (parts_company_id, used_bytes, updated_at)
      select c, coalesce((select sum(size_bytes) from public.parts_photo_objects where parts_company_id = c), 0), now()
        from unnest(cids) c
    on conflict (parts_company_id) do update set used_bytes = excluded.used_bytes, updated_at = now();
  end if;
  return n;
end $$;

-- Какие из ключей зарегистрированы (для поиска файлов R2 без записи в базе)
create or replace function public.photo_known_keys(p_secret text, p_keys text[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare res text[];
begin
  perform public._photo_check_secret(p_secret);
  select coalesce(array_agg(o.key), '{}') into res from public.parts_photo_objects o where o.key = any(p_keys);
  return res;
end $$;

-- Самовосстановление счётчика: used_bytes = сумма size_bytes по всем компаниям
create or replace function public.photo_recompute_usage(p_secret text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._photo_check_secret(p_secret);
  with s as (
    select c.id as cid, coalesce((select sum(size_bytes) from public.parts_photo_objects where parts_company_id = c.id), 0) as b
      from public.parts_companies c
     where exists (select 1 from public.parts_photo_usage u where u.parts_company_id = c.id)
        or exists (select 1 from public.parts_photo_objects o where o.parts_company_id = c.id)
  ), up as (
    insert into public.parts_photo_usage (parts_company_id, used_bytes, updated_at)
      select cid, b, now() from s
    on conflict (parts_company_id) do update set used_bytes = excluded.used_bytes, updated_at = now()
    returning 1
  ) select count(*)::int into n from up;
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'photo_orphans(text, interval, int)', 'photo_purge(text, text[])',
    'photo_known_keys(text, text[])', 'photo_recompute_usage(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- ПРОВЕРКА после применения (подставить секрет):
--  select * from photo_orphans('<secret>', '3 days', 10);
--  select photo_known_keys('<secret>', array['c/x/y/full.jpg']);
--  select photo_orphans('wrong');   -- FORBIDDEN
