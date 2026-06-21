-- SECURITY: сужение доступа к parts_companies (anon видел ВСЕ активные компании со всеми
-- колонками, вкл. секреты photo_config/telegram_chat_id) + RLS на trash_bin.
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh). Проверено симуляцией ролей.

-- Хелпер: текущий пользователь — admin (SECURITY DEFINER, обходит RLS user_roles).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin');
$$;

-- ── parts_companies ──────────────────────────────────────────────────────────
-- anon: только safe-колонки (без photo_config/settings/telegram_chat_id-секретов).
revoke select on public.parts_companies from anon;
grant select (
  id, name, phone, telegram, address, city, email, description,
  is_active, market_published, ship_speed, warranty_enabled, warranty_days
) on public.parts_companies to anon;

-- Сносим широкие USING(true) политики (любой authenticated читал/правил ВСЕ компании).
drop policy if exists "Allow authenticated users to manage parts_companies" on public.parts_companies;
drop policy if exists "Allow authenticated users to read parts_companies" on public.parts_companies;
drop policy if exists "Public can view active parts companies" on public.parts_companies;

-- Публичное чтение — только опубликованные (anon + authenticated, для витрины/поставщиков).
create policy "Public can view published parts companies" on public.parts_companies
  for select to anon, authenticated using (is_active and market_published);
-- Админ — полный доступ.
create policy "parts_companies_admin_all" on public.parts_companies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Создание компании (онбординг владельца / админ).
create policy "parts_companies_insert" on public.parts_companies
  for insert to authenticated with check (true);
-- (Остаются: "Parts company members can view their company" — своя; "Parts company owners
--  can update their company" — апдейт своей.)

-- ── trash_bin ────────────────────────────────────────────────────────────────
alter table public.trash_bin enable row level security;
create policy "trash_bin_company" on public.trash_bin for all to authenticated
  using (public.is_my_parts_company(parts_company_id))
  with check (public.is_my_parts_company(parts_company_id));
