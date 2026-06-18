-- Каталог авто (справочник) + каскадные фильтры маркета: Марка → Модель → Год.
-- Источник марок/моделей — справочник car_models (стандартизированные имена).
-- Год и количество — из реально доступных опубликованных запчастей.
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

-- Черновой вариант (фасеты из данных) заменён справочным каталогом.
drop function if exists public.get_market_vehicle_facets();

-- ── Справочник моделей авто ────────────────────────────────────────────────
create table if not exists public.car_models (
  id          uuid primary key default gen_random_uuid(),
  make        text not null,
  model       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (make, model)
);

alter table public.car_models enable row level security;

drop policy if exists car_models_public_read on public.car_models;
create policy car_models_public_read on public.car_models
  for select to anon, authenticated using (is_active);

grant select on public.car_models to anon, authenticated;

-- ── Сид: Tesla (стандартные имена) ─────────────────────────────────────────
insert into public.car_models (make, model, sort_order) values
  ('Tesla', 'Model 3',    10),
  ('Tesla', 'Model Y',    20),
  ('Tesla', 'Model X',    30),
  ('Tesla', 'Model S',    40),
  ('Tesla', 'Cybertruck', 50)
on conflict (make, model) do nothing;

-- ── Нормализация существующих авто к стандарту ─────────────────────────────
update public.parts_vehicles set make = 'Tesla'
  where lower(btrim(make)) = 'tesla' and make <> 'Tesla';

update public.parts_vehicles set model = 'Model 3'
  where lower(btrim(make)) = 'tesla' and lower(btrim(model)) in ('model 3','model3','m3','3') and model <> 'Model 3';
update public.parts_vehicles set model = 'Model Y'
  where lower(btrim(make)) = 'tesla' and lower(btrim(model)) in ('model y','modely','my','y') and model <> 'Model Y';
update public.parts_vehicles set model = 'Model X'
  where lower(btrim(make)) = 'tesla' and lower(btrim(model)) in ('model x','modelx','mx','x') and model <> 'Model X';
update public.parts_vehicles set model = 'Model S'
  where lower(btrim(make)) = 'tesla' and lower(btrim(model)) in ('model s','models','ms','s') and model <> 'Model S';
update public.parts_vehicles set model = 'Cybertruck'
  where lower(btrim(make)) = 'tesla' and lower(btrim(model)) in ('cybertruck','cyber truck','ct') and model <> 'Cybertruck';

-- ── RPC: каталог авто с доступностью (для фильтров маркета) ─────────────────
-- Возвращает ВЕСЬ справочник (даже модели без товаров) + доступные годы и счётчики.
create or replace function public.get_market_car_catalog()
returns json language sql stable security definer set search_path = public as $fn$
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
      coalesce(ma.years, '[]'::json) as years
    from public.car_models cm
    left join model_av ma on ma.lmake = lower(cm.make) and ma.lmodel = lower(cm.model)
    where cm.is_active
  ),
  makes as (
    select make, sum(cnt)::int as cnt,
      json_agg(json_build_object('model', model, 'count', cnt, 'years', years) order by sort_order, model) as models
    from models
    group by make
  )
  select coalesce(json_agg(json_build_object('make', make, 'count', cnt, 'models', models) order by make), '[]'::json)
  from makes;
$fn$;

grant execute on function public.get_market_car_catalog() to anon, authenticated;
