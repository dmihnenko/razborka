-- ============================================================================
-- Security hardening — аудит 2026-06-25 (docs/security-audit-2026-06-25.md)
-- Закрывает: захват admin через user_roles/roles, правку тарифов/подписок,
-- открытые support-чаты, UPDATE notifications без CHECK, anon-склады по is_active.
-- Применяется вручную через Management API. Хелперы is_admin()/my_parts_company_id()
-- уже есть (SECURITY DEFINER). Легитимные присвоения ролей идут через
-- claim_personal_user_role()/self_provision_parts_company() (SECURITY DEFINER, обходят RLS)
-- и через admin (политика is_admin()); parts_owner управляет ТОЛЬКО ролью parts_worker
-- своих сотрудников (политика ниже).
-- ============================================================================

-- ── helper: текущий пользователь — владелец разборки? (SECURITY DEFINER, без рекурсии RLS) ──
create or replace function public.is_parts_owner()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'parts_owner'
  );
$$;
revoke all on function public.is_parts_owner() from public;
grant execute on function public.is_parts_owner() to authenticated;

-- ============ C1: user_roles — самоназначение admin закрыто ============
drop policy if exists "Allow authenticated users to manage user_roles" on public.user_roles;
drop policy if exists "Allow authenticated users to read user_roles"   on public.user_roles;

create policy user_roles_select on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or user_id in (select id from public.user_profiles
                   where parts_company_id = public.my_parts_company_id())
  );

-- запись ролей админом (одобрение заявок, управление юзерами)
create policy user_roles_admin_write on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- parts_owner управляет ТОЛЬКО ролью parts_worker и ТОЛЬКО для сотрудников своей компании
-- (нельзя выдать admin/parts_owner; нельзя трогать чужие компании). Цель user_profiles виден
-- владельцу по RLS только в своей компании → подзапрос вернёт NULL для чужого и заблокирует.
create policy user_roles_owner_worker_write on public.user_roles for all to authenticated
  using (
    public.is_parts_owner()
    and role_id in (select id from public.roles where name = 'parts_worker')
    and (select parts_company_id from public.user_profiles where id = user_roles.user_id)
        = public.my_parts_company_id()
  )
  with check (
    public.is_parts_owner()
    and role_id in (select id from public.roles where name = 'parts_worker')
    and (select parts_company_id from public.user_profiles where id = user_roles.user_id)
        = public.my_parts_company_id()
  );

-- ============ C2: roles — справочник, запись только admin ============
drop policy if exists "Allow authenticated users to manage roles" on public.roles;
-- чтение оставляем (нужно для резолва имён ролей в UI)
drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H2: company_subscriptions — чтение своя/admin, запись только admin ============
drop policy if exists "Allow admin to manage company_subscriptions"            on public.company_subscriptions;
drop policy if exists "Allow authenticated users to read company_subscriptions" on public.company_subscriptions;

create policy company_subscriptions_select on public.company_subscriptions for select to authenticated
  using (public.is_admin()
         or (company_type = 'parts' and company_id = public.my_parts_company_id()));
create policy company_subscriptions_admin_write on public.company_subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H3: subscriptions (каталог тарифов) — запись только admin ============
drop policy if exists "Allow admin to manage subscriptions" on public.subscriptions;
-- публичное/authenticated чтение оставляем (Public read active parts plans)
drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ H1: support_chats / support_messages — включить RLS ============
alter table public.support_chats    enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_chats_rw on public.support_chats;
create policy support_chats_rw on public.support_chats for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists support_messages_rw on public.support_messages;
create policy support_messages_rw on public.support_messages for all to authenticated
  using (chat_id in (select id from public.support_chats where owner_id = auth.uid())
         or public.is_admin())
  with check (
    public.is_admin()
    or (sender_id = auth.uid()
        and chat_id in (select id from public.support_chats where owner_id = auth.uid()))
  );

-- ============ M1: notifications — UPDATE с WITH CHECK (нельзя подменить user_id) ============
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ M2: parts_storage_locations — anon только опубликованные витрины ============
drop policy if exists parts_storage_locations_public_select on public.parts_storage_locations;
create policy parts_storage_locations_public_select on public.parts_storage_locations for select to anon
  using (parts_company_id in (select id from public.parts_companies
                              where is_active and market_published));
