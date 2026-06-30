-- ЭТАП 5 (БД). Подписка по умолчанию для новых разборок.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-30.
--
-- Настройка в app_settings (key/value text — там же глобальный курс USD):
--   default_company_plan_id  — uuid плана (NULL/нет ключа = Демо).
--   default_company_months   — int срок в месяцах (NULL/нет ключа = бессрочно).
-- Триггер новой parts-компании читает настройку; admin-RPC сохраняет её.

-- ── 1. Триггер новой parts-компании: план по умолчанию или Демо ───────────────
create or replace function public.assign_demo_subscription_to_parts()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_plan_id   uuid;
  v_months    int;
  v_termless  boolean;
  v_end       timestamptz;
  demo_id     uuid;
begin
  -- настройка из app_settings
  select nullif(value,'')::uuid into v_plan_id from public.app_settings where key = 'default_company_plan_id';
  select nullif(value,'')::int  into v_months  from public.app_settings where key = 'default_company_months';

  -- выбранный план должен быть валиден; иначе откатываемся на Демо
  if v_plan_id is not null and not exists (
       select 1 from public.subscriptions where id = v_plan_id and is_active and company_type = 'parts') then
    v_plan_id := null;
  end if;

  if v_plan_id is not null then
    select (price = 0 or type = 'lifetime') into v_termless
      from public.subscriptions where id = v_plan_id;
    v_end := case
               when v_termless then null
               when v_months is null or v_months <= 0 then null
               else now() + make_interval(months => v_months)
             end;
    insert into public.company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active, status)
    values ('parts', NEW.id, v_plan_id, now(), v_end, true, 'active')
    on conflict do nothing;
  else
    -- Демо бессрочно (прежнее поведение)
    select id into demo_id from public.subscriptions
      where company_type = 'parts' and is_demo and is_active order by created_at limit 1;
    if demo_id is not null then
      insert into public.company_subscriptions
        (company_type, company_id, subscription_id, start_date, end_date, is_active, status)
      values ('parts', NEW.id, demo_id, now(), null, true, 'active')
      on conflict do nothing;
    end if;
  end if;

  return NEW;
exception when others then
  raise warning 'assign_demo_subscription_to_parts failed: %', SQLERRM;
  return NEW;
end; $fn$;

-- ── 2. Админ-RPC: сохранить настройку по умолчанию ────────────────────────────
create or replace function public.admin_set_default_company_plan(
  p_plan_id uuid default null, p_months int default null
)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Только администратор' using errcode = '42501';
  end if;
  if p_plan_id is not null and not exists (
       select 1 from public.subscriptions where id = p_plan_id and is_active and company_type = 'parts') then
    raise exception 'План не найден или неактивен' using errcode = 'P0001';
  end if;

  insert into public.app_settings (key, value, updated_at)
    values ('default_company_plan_id', p_plan_id::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.app_settings (key, value, updated_at)
    values ('default_company_months', case when p_months is null then null else p_months::text end, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end; $fn$;
revoke all on function public.admin_set_default_company_plan(uuid, int) from public;
grant execute on function public.admin_set_default_company_plan(uuid, int) to authenticated;

-- ── 3. Чтение настройки фронтом (read-only, для всех authenticated админов) ────
create or replace function public.admin_get_default_company_plan()
returns table(plan_id uuid, months int)
language sql security definer set search_path to 'public' as $fn$
  select
    (select nullif(value,'')::uuid from public.app_settings where key = 'default_company_plan_id'),
    (select nullif(value,'')::int  from public.app_settings where key = 'default_company_months');
$fn$;
revoke all on function public.admin_get_default_company_plan() from public;
grant execute on function public.admin_get_default_company_plan() to authenticated;
