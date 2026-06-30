-- Хардненинг: чтение настройки «подписка по умолчанию для новых разборок» — только админ.
-- Раньше admin_get_default_company_plan не имел is_admin-guard (низкая чувствительность, но
-- это админ-настройка). Добавляем guard. Применяется через Management API (ref hwckvddevjucuzxdoqqh).

create or replace function public.admin_get_default_company_plan()
returns table(plan_id uuid, months integer)
language sql security definer set search_path to 'public' as $fn$
  select
    (select nullif(value,'')::uuid from public.app_settings where key = 'default_company_plan_id'),
    (select nullif(value,'')::int  from public.app_settings where key = 'default_company_months')
  where public.is_admin();
$fn$;
