-- P1: кэш фасетов каталога (Марка→Модель→Год).
-- get_market_car_catalog() агрегировал ВЕСЬ доступный инвентарь на каждый заход в
-- каталог — при 1M строк это самая дорогая операция. Фасеты меняются медленно →
-- считаем в фоне (pg_cron каждые 5 мин) и отдаём из кэша мгновенно.
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

-- 1) Чистый расчёт (тот же CTE, что был в get_market_car_catalog), возвращает jsonb.
create or replace function public.compute_market_car_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with avail as (
    select nullif(btrim(v.make), '') as make, nullif(btrim(v.model), '') as model, v.year
    from public.parts_inventory pi
    join public.parts_vehicles  v on v.id = pi.vehicle_id
    join public.parts_companies c on c.id = pi.parts_company_id
    where pi.status = 'available' and coalesce(pi.selling_price, 0) > 0
      and c.is_active and c.market_published
  ),
  model_av as (
    select lower(make) as lmake, lower(model) as lmodel, count(*) as cnt,
      coalesce(json_agg(distinct year order by year) filter (where year is not null), '[]'::json) as years
    from avail
    where make is not null and model is not null
    group by lower(make), lower(model)
  ),
  models as (
    select cm.make, cm.model, cm.sort_order,
      coalesce(ma.cnt, 0)::int as cnt,
      case
        when cm.year_from is not null and cm.year_to is not null and cm.year_to >= cm.year_from
          then (select coalesce(json_agg(g order by g desc), '[]'::json) from generate_series(cm.year_from, cm.year_to) g)
        else coalesce(ma.years, '[]'::json)
      end as years
    from public.car_models cm
    left join model_av ma on ma.lmake = lower(cm.make) and ma.lmodel = lower(cm.model)
    where cm.is_active and cm.status = 'approved'
  ),
  makes as (
    select make, sum(cnt)::int as cnt,
      json_agg(json_build_object('model', model, 'count', cnt, 'years', years) order by sort_order, model) as models
    from models
    group by make
  )
  select coalesce(json_agg(json_build_object('make', make, 'count', cnt, 'models', models) order by make), '[]'::json)::jsonb
  from makes;
$$;

-- 2) Кэш-таблица (одна строка).
create table if not exists public.market_facets_cache (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Пересчёт кэша (вызывает pg_cron).
create or replace function public.refresh_market_car_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.market_facets_cache (id, data, updated_at)
  values (1, public.compute_market_car_catalog(), now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
end;
$$;

-- 4) Публичная функция: отдаёт кэш, при пустом кэше считает на лету (без записи).
create or replace function public.get_market_car_catalog()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select data from public.market_facets_cache where id = 1),
    public.compute_market_car_catalog()
  )::json;
$$;

grant execute on function public.get_market_car_catalog() to anon, authenticated;

-- 5) Фоновое обновление каждые 5 минут (pg_cron уже установлен).
do $$ begin perform cron.unschedule('refresh-market-facets'); exception when others then null; end $$;
select cron.schedule('refresh-market-facets', '*/5 * * * *', 'select public.refresh_market_car_catalog();');

-- 6) Первичное наполнение кэша.
select public.refresh_market_car_catalog();
