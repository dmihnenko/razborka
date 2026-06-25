-- M3 (аудит 2026-06-25): убрать плейнтекст-пароли.
-- На проде сейчас 0 непустых значений; единственный писатель — create_user_account.
-- Патчим функцию (перестаёт писать plain_password) и дропаем колонку из users/user_profiles.

create or replace function public.create_user_account(
  p_email text, p_password text, p_full_name text, p_phone text,
  p_role_ids uuid[], p_primary_role_id uuid,
  p_sto_company_id uuid default null::uuid,
  p_parts_company_id uuid default null::uuid,
  p_username text default null::text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_is_admin boolean;
begin
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid() and r.name = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    return json_build_object('success', false, 'error', 'Access denied');
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone),
    now(), now(), '', '', '', ''
  );

  -- plain_password больше НЕ сохраняем (пароль только в auth.users как bcrypt-хеш)
  insert into public.users (
    id, email, full_name, phone, primary_role_id, parts_company_id, username
  ) values (
    v_user_id, p_email, p_full_name, p_phone, p_primary_role_id, p_parts_company_id, p_username
  );

  foreach v_role_id in array p_role_ids loop
    insert into public.user_roles (user_id, role_id) values (v_user_id, v_role_id);
  end loop;

  return json_build_object('success', true, 'user_id', v_user_id);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- Дроп колонок (CASCADE на случай зависимостей вью; данных нет)
alter table public.users         drop column if exists plain_password cascade;
alter table public.user_profiles drop column if exists plain_password cascade;
