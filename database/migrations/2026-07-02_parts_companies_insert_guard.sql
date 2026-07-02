-- Хардненинг (2026-07-02): parts_companies INSERT был WITH CHECK (true) —
-- любой authenticated мог плодить компании по API (спам/размножение демо-лимитов).
-- Онбординг владельца создаёт ПЕРВУЮ компанию, когда его user_profiles.parts_company_id
-- ещё NULL, затем проставляет его → следующий insert уже заблокирован. Админ создаёт
-- компании для других через is_admin(). Применяется вручную через Management API.

drop policy if exists parts_companies_insert on public.parts_companies;
create policy parts_companies_insert on public.parts_companies
  for insert to authenticated
  with check (
    (select parts_company_id from public.user_profiles where id = auth.uid()) is null
    or public.is_admin()
  );
