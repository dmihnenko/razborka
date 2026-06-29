-- Скрытие онбординг-карточки «Всё настроено» — хранить в БД (а не localStorage),
-- чтобы не появлялась снова на другом устройстве/браузере. Per-company флаг.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-29.

alter table public.parts_companies
  add column if not exists onboarding_dismissed boolean not null default false;

-- Скрыть онбординг для своей разборки (вызывает владелец/работник).
create or replace function public.dismiss_company_onboarding()
returns void language sql security definer set search_path = public as $fn$
  update public.parts_companies
    set onboarding_dismissed = true
    where id = public.my_parts_company_id();
$fn$;

revoke all on function public.dismiss_company_onboarding() from public;
grant execute on function public.dismiss_company_onboarding() to authenticated;
