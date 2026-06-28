-- Закрытие RLS-утечек: кросс-тенантный доступ через политики USING(true).
-- Найдено аудитом 2026-06-29 (Management API, ref hwckvddevjucuzxdoqqh).
--
-- 1) parts_categories — публичная SELECT-политика была USING(true) для {anon,authenticated}:
--    любой видел категории ВСЕХ разборок (кросс-тенант + аноним). Категории — тенант-данные
--    (есть parts_company_id). Маркету реально нужны только категории ОПУБЛИКОВАННЫХ разборок
--    (join market_inventory→parts_categories в getMarketCategories). Делаем как у parts_vehicles:
--    публично видны лишь категории active+market_published компаний; authenticated — свои + они же.
--
-- 2) parts_catalog — легаси-таблица старого маркета (фронтом не используется), содержит контакты
--    (phone/address/name = PII), была открыта USING(true) для public. Снимаем публичный доступ:
--    оставляем только своей компании + админ.

-- ── 1. parts_categories ──────────────────────────────────────────────────────
drop policy if exists parts_categories_public_select on public.parts_categories;
drop policy if exists parts_categories_select        on public.parts_categories;

-- аноним: только категории опубликованных в маркете разборок
create policy parts_categories_public_select on public.parts_categories
  for select to anon
  using (parts_company_id in (
    select id from public.parts_companies where is_active and market_published
  ));

-- залогиненный: свои + опубликованные (как parts_vehicles_select)
create policy parts_categories_select on public.parts_categories
  for select to authenticated
  using (
    public.is_my_parts_company(parts_company_id)
    or parts_company_id in (
      select id from public.parts_companies where is_active and market_published
    )
  );

-- ── 2. parts_catalog ─────────────────────────────────────────────────────────
drop policy if exists parts_catalog_select_all on public.parts_catalog;

-- доступ только своей компании + админ (легаси-данные, публично закрыты)
create policy parts_catalog_select on public.parts_catalog
  for select to authenticated
  using (
    public.is_admin()
    or company_id = (select parts_company_id from public.user_profiles where id = auth.uid())
  );
