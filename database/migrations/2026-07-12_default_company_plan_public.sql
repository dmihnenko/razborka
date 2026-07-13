-- Публичная RPC: эффективный план по умолчанию для НОВЫХ разборок — чтобы лендинг
-- /business показывал реальность (Демо или триал «N мес тарифа X»), совпадая с тем,
-- что назначит триггер assign_demo_subscription_to_parts.
--
-- Читает app_settings (default_company_plan_id / default_company_months); если план
-- не задан/невалиден — откатывается на план «Демо» (is_demo). Возвращает только
-- безопасные поля тарифа (имя/лимиты/срок), НЕ раскрывает прочие app_settings.
-- SECURITY DEFINER, execute для anon (лендинг публичный).

create or replace function public.get_default_company_plan_public()
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_plan_id uuid;
  v_months  int;
  r         public.subscriptions%rowtype;
  v_months_eff int;
begin
  select nullif(value,'')::uuid into v_plan_id from public.app_settings where key = 'default_company_plan_id';
  select nullif(value,'')::int  into v_months  from public.app_settings where key = 'default_company_months';

  if v_plan_id is not null then
    select * into r from public.subscriptions
      where id = v_plan_id and is_active and company_type = 'parts';
  end if;

  if r.id is null then
    -- фолбэк на Демо (бессрочно)
    select * into r from public.subscriptions
      where company_type = 'parts' and is_demo and is_active
      order by created_at limit 1;
    v_months := null;
  end if;

  if r.id is null then
    return null;
  end if;

  -- бесплатный/бессрочный план — без срока
  v_months_eff := case when (coalesce(r.price,0) = 0 or r.type = 'lifetime') then null else v_months end;

  return json_build_object(
    'name',          r.name,
    'price',         r.price,
    'is_demo',       coalesce(r.is_demo, false),
    'max_vehicles',  r.max_vehicles,
    'max_parts',     r.max_parts,
    'max_workers',   r.max_workers,
    'has_analytics', r.has_analytics,
    'months',        v_months_eff
  );
end
$fn$;

revoke all on function public.get_default_company_plan_public() from public;
grant execute on function public.get_default_company_plan_public() to anon, authenticated;
