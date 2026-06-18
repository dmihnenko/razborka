-- Заявки на новые марки/модели авто: ручной ввод при создании авто на разборку
-- создаёт pending-запись в car_models, админ утверждает её в каталог.
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

-- ── Колонки модерации ──────────────────────────────────────────────────────
alter table public.car_models
  add column if not exists status            text not null default 'approved',
  add column if not exists suggested_by      uuid,
  add column if not exists parts_company_id  uuid,
  add column if not exists reviewed_at       timestamptz,
  add column if not exists reviewed_by       uuid,
  add column if not exists rejection_reason  text;

do $$ begin
  alter table public.car_models
    add constraint car_models_status_chk check (status in ('approved','pending','rejected'));
exception when duplicate_object then null; end $$;

create index if not exists idx_car_models_status on public.car_models(status);

-- ── Политики RLS ───────────────────────────────────────────────────────────
-- Публично — только утверждённые и активные.
drop policy if exists car_models_public_read on public.car_models;
create policy car_models_public_read on public.car_models
  for select to anon, authenticated using (is_active and status = 'approved');

-- Админ — полный доступ (видит pending, утверждает/отклоняет).
drop policy if exists car_models_admin_all on public.car_models;
create policy car_models_admin_all on public.car_models
  for all to authenticated
  using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'))
  with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'));

-- Любой авторизованный — предложить новую марку/модель (только pending, от своего имени).
drop policy if exists car_models_suggest on public.car_models;
create policy car_models_suggest on public.car_models
  for insert to authenticated
  with check (status = 'pending' and suggested_by = auth.uid());

grant insert, update on public.car_models to authenticated;

-- ── RPC каталога: только утверждённые ──────────────────────────────────────
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
