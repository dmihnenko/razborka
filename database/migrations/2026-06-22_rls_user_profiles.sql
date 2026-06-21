-- SECURITY: user_profiles был полностью открыт — anon читал ВСЕ профили (вкл. plain_password!),
-- любой authenticated читал/менял любой профиль (захват тенанта сменой parts_company_id, эскалация
-- role_id/is_active). Закрываем: чтение self+своя компания+admin; смена защищённых полей — только
-- admin/service_role; anon больше не читает таблицу (логин по username — через definer-RPC).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh). Проверено симуляцией ролей.

-- Хелпер: компания текущего пользователя (definer → без рекурсии RLS).
create or replace function public.my_parts_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select parts_company_id from public.user_profiles where id = auth.uid();
$$;

-- RPC для логина по username (anon): отдаёт только email, не открывая таблицу.
create or replace function public.get_email_by_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select email from public.user_profiles where username = lower(p_username) limit 1;
$$;
grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- Триггер: запрет смены parts_company_id/role_id/is_active для обычного authenticated
-- (admin и service_role/edge-функции — разрешено).
-- NB: НЕ security definer — иначе current_user стал бы владельцем функции (postgres),
-- и проверка роли вызывающего не работала бы. is_admin() ниже остаётся definer отдельно.
create or replace function public.guard_user_profile_protected()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.parts_company_id is distinct from old.parts_company_id
      or new.role_id is distinct from old.role_id
      or new.is_active is distinct from old.is_active)
     and current_user = 'authenticated'
     and not public.is_admin()
  then
    raise exception 'Изменение parts_company_id/role_id/is_active запрещено (только администратор)';
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_user_profile on public.user_profiles;
create trigger trg_guard_user_profile before update on public.user_profiles
  for each row execute function public.guard_user_profile_protected();

-- Сносим широкие политики.
drop policy if exists "Allow all for authenticated users" on public.user_profiles;
drop policy if exists "Allow anon select on user_profiles" on public.user_profiles;
drop policy if exists "Users can view all profiles" on public.user_profiles;

-- Чтение: свой профиль, или член своей компании, или admin.
create policy "user_profiles_select" on public.user_profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (parts_company_id is not null and parts_company_id = public.my_parts_company_id())
  );
-- Обновление: свой профиль или admin (защищённые поля стережёт триггер).
create policy "user_profiles_update" on public.user_profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Удаление: только admin.
create policy "user_profiles_delete" on public.user_profiles for delete to authenticated
  using (public.is_admin());
-- (Остаётся "Users can insert own profile" — регистрация своего профиля.)

-- anon больше не читает таблицу напрямую (есть RPC get_email_by_username).
revoke select on public.user_profiles from anon;
