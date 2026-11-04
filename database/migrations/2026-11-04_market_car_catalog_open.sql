-- Открытый справочник авто для подбора: Марка -> Модель -> Год с количеством.
-- Основа = утверждённые car_models + пары марка/модель из доступных товаров.
-- Идемпотентно. Применяется вручную.

-- 1. Нормализация пробелов в parts_vehicles.make/model ------------------------
create or replace function public.parts_vehicles_trim_names()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.make  := btrim(new.make);
  new.model := btrim(new.model);
  return new;
end;
$$;

drop trigger if exists trg_parts_vehicles_trim_names on public.parts_vehicles;
create trigger trg_parts_vehicles_trim_names
  before insert or update on public.parts_vehicles
  for each row execute function public.parts_vehicles_trim_names();

-- разовая очистка (строки без лишних пробелов не трогаем, updated_at не меняется)
update public.parts_vehicles
   set make = btrim(make), model = btrim(model)
 where make <> btrim(make) or model <> btrim(model);

-- 2. compute_market_car_catalog -----------------------------------------------
create or replace function public.compute_market_car_catalog()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with avail as (
    select nullif(btrim(v.make), '') as make, nullif(btrim(v.model), '') as model, v.year
    from public.parts_inventory pi
    join public.parts_vehicles  v on v.id = pi.vehicle_id
    join public.parts_companies c on c.id = pi.parts_company_id
    where pi.status = 'available' and coalesce(pi.selling_price, 0) > 0
      and c.is_active and c.market_published
  ),
  av as (
    select make, model, year from avail where make is not null and model is not null
  ),
  -- отклонённые/выключенные модели; pending-заявки (is_active=false по умолчанию) не блокируют
  blocked as (
    select lower(btrim(make)) as lmake, lower(btrim(model)) as lmodel
    from public.car_models
    where status = 'rejected' or (is_active = false and status <> 'pending')
  ),
  appr as (
    select distinct on (lower(btrim(make)), lower(btrim(model)))
      lower(btrim(make)) as lmake, lower(btrim(model)) as lmodel,
      btrim(make) as make, btrim(model) as model, sort_order
    from public.car_models
    where is_active and status = 'approved'
    order by lower(btrim(make)), lower(btrim(model)), sort_order, model
  ),
  model_av as (
    select lower(make) as lmake, lower(model) as lmodel, count(*) as cnt,
      mode() within group (order by make)  as make,
      mode() within group (order by model) as model
    from av
    group by lower(make), lower(model)
  ),
  year_cnt as (
    select lower(make) as lmake, lower(model) as lmodel, year, count(*) as c
    from av where year is not null
    group by lower(make), lower(model), year
  ),
  yrs as (
    select lmake, lmodel,
      json_agg(year order by year) as years,
      jsonb_object_agg(year::text, c) as year_counts
    from year_cnt
    group by lmake, lmodel
  ),
  make_mode as (
    select lower(make) as lmake, mode() within group (order by make) as make
    from av group by lower(make)
  ),
  make_appr as (
    select lmake, min(make) as make from appr group by lmake
  ),
  make_name as (
    select coalesce(a.lmake, m.lmake) as lmake, coalesce(a.make, m.make) as make
    from make_appr a full join make_mode m on m.lmake = a.lmake
  ),
  keys as (
    select lmake, lmodel from appr
    union
    select ma.lmake, ma.lmodel from model_av ma
    where not exists (select 1 from blocked b where b.lmake = ma.lmake and b.lmodel = ma.lmodel)
  ),
  models as (
    select k.lmake,
      coalesce(a.model, ma.model) as model,
      coalesce(a.sort_order, 2147483647) as sort_order,
      coalesce(ma.cnt, 0)::int as cnt,
      coalesce(y.years, '[]'::json) as years,
      coalesce(y.year_counts, '{}'::jsonb) as year_counts,
      (a.lmake is not null) as approved
    from keys k
    left join appr     a  on a.lmake  = k.lmake and a.lmodel  = k.lmodel
    left join model_av ma on ma.lmake = k.lmake and ma.lmodel = k.lmodel
    left join yrs      y  on y.lmake  = k.lmake and y.lmodel  = k.lmodel
  ),
  makes as (
    select mn.make, sum(m.cnt)::int as cnt,
      json_agg(json_build_object(
        'model', m.model, 'count', m.cnt, 'years', m.years,
        'year_counts', m.year_counts, 'approved', m.approved
      ) order by m.sort_order, m.model) as models
    from models m
    join make_name mn on mn.lmake = m.lmake
    group by mn.make
  )
  select coalesce(json_agg(json_build_object('make', make, 'count', cnt, 'models', models) order by make), '[]'::json)::jsonb
  from makes;
$function$;

-- 3. Безопасность кэша и функций ---------------------------------------------
alter table public.market_facets_cache enable row level security;
revoke all on table public.market_facets_cache from public, anon, authenticated;

revoke execute on function public.compute_market_car_catalog() from public, anon, authenticated;
revoke execute on function public.refresh_market_car_catalog() from public, anon, authenticated;
grant  execute on function public.get_market_car_catalog() to anon, authenticated;

-- 4. Обновить кэш -------------------------------------------------------------
select public.refresh_market_car_catalog();
