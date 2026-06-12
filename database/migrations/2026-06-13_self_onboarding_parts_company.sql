-- Само-онбординг разборки: подача заявки СРАЗУ создаёт разборку (без одобрения админа).
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
--
-- RPC зеркалит approveAccessRequest для parts_owner, но делает это для самого
-- вызывающего (auth.uid()) и сразу: создаёт parts_companies, назначает роль
-- parts_owner, проставляет user_profiles.parts_company_id. Подписку НЕ создаёт —
-- без подписки действует демо-режим (FREE_LIMITS 50 запч/3 авто), публикация
-- витрины на маркете — только по платному тарифу (флаг market_published).
--
-- Безопасность: SECURITY DEFINER, но оперирует ТОЛЬКО auth.uid() — пользователь
-- может создать разборку только себе и только одну (COMPANY_ALREADY_EXISTS).
-- execute разрешён только authenticated, отозван у anon/public.

create or replace function public.self_provision_parts_company(
  p_company_name text,
  p_address text,
  p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_role_id uuid;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if nullif(trim(coalesce(p_company_name,'')),'') is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  select parts_company_id into v_existing from public.user_profiles where id = v_uid;
  if v_existing is not null then
    raise exception 'COMPANY_ALREADY_EXISTS';
  end if;

  insert into public.parts_companies (name, address, phone, is_active)
  values (trim(p_company_name), nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_phone,'')),''), true)
  returning id into v_company_id;

  select id into v_role_id from public.roles where name = 'parts_owner';
  if v_role_id is not null then
    insert into public.user_roles (user_id, role_id, is_primary)
    values (v_uid, v_role_id, true)
    on conflict (user_id, role_id) do update set is_primary = true;
  end if;

  update public.user_profiles set parts_company_id = v_company_id where id = v_uid;

  return v_company_id;
end;
$fn$;

revoke execute on function public.self_provision_parts_company(text,text,text) from anon, public;
grant execute on function public.self_provision_parts_company(text,text,text) to authenticated;
