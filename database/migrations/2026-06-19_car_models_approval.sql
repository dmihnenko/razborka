-- Утверждение марок/моделей админом: правка написания + года выпуска + (позже) стандартные категории.
-- При утверждении нормализуем авто разборок к утверждённому написанию и сливаем дубли каталога.
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

-- ── Года выпуска (для фильтров) + задел под стандартные категории ───────────
alter table public.car_models
  add column if not exists year_from int,
  add column if not exists year_to   int,
  add column if not exists standard_categories text[] not null default '{}';

-- ── RPC: утвердить заявку (правка имени + года + категории), атомарно ───────
create or replace function public.approve_car_model(
  p_id uuid,
  p_make text,
  p_model text,
  p_year_from int default null,
  p_year_to int default null,
  p_categories text[] default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_old_make text; v_old_model text;
  v_make text := btrim(p_make); v_model text := btrim(p_model);
  v_existing uuid;
begin
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin') then
    raise exception 'forbidden';
  end if;
  if v_make = '' or v_model = '' then raise exception 'make/model required'; end if;

  select make, model into v_old_make, v_old_model from public.car_models where id = p_id;
  if v_old_make is null then raise exception 'not found'; end if;

  -- Нормализуем авто разборок со старым написанием к утверждённому
  update public.parts_vehicles set make = v_make, model = v_model
   where lower(btrim(make)) = lower(v_old_make) and lower(btrim(model)) = lower(v_old_model);

  -- Если утверждённое имя уже есть в каталоге (другой строкой) — слить в неё
  select id into v_existing from public.car_models
   where lower(make) = lower(v_make) and lower(model) = lower(v_model) and id <> p_id;

  if v_existing is not null then
    update public.car_models set
      is_active = true, status = 'approved',
      year_from = coalesce(p_year_from, year_from),
      year_to   = coalesce(p_year_to, year_to),
      standard_categories = coalesce(p_categories, standard_categories),
      reviewed_at = now(), reviewed_by = auth.uid()
     where id = v_existing;
    delete from public.car_models where id = p_id;
  else
    update public.car_models set
      make = v_make, model = v_model, status = 'approved', is_active = true,
      year_from = p_year_from, year_to = p_year_to,
      standard_categories = coalesce(p_categories, standard_categories),
      rejection_reason = null, reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_id;
  end if;
end;
$fn$;

grant execute on function public.approve_car_model(uuid, text, text, int, int, text[]) to authenticated;

-- ── RPC каталога: года для фильтра из заданного админом диапазона ───────────
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
  select coalesce(json_agg(json_build_object('make', make, 'count', cnt, 'models', models) order by make), '[]'::json)
  from makes;
$fn$;

grant execute on function public.get_market_car_catalog() to anon, authenticated;
