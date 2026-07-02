-- 🔴 КРИТИЧНО (найдено QA 2026-07-02): parts_vehicles отдавал ВСЮ строку для
-- market_published-компаний → аноним (публичный anon-ключ) и любой authenticated
-- читали ЗАКУПОЧНУЮ ЦЕНУ / exchange_rate / purchase_date / notes / vin доноров ВСЕХ
-- опубликованных разборок (утечка себестоимости, маржи и VIN конкурентам).
-- Причина: RLS фильтрует строки, но не колонки; у anon были колонк-гранты на все поля,
-- у authenticated политика (is_my OR published) отдавала чужие строки целиком.
--
-- Фикс (паттерн как у parts_inventory / market_inventory):
--  1) anon — column-level: только безопасные поля (make/model/year/vin/статус/фото/…),
--     БЕЗ purchase_price/purchase_date/exchange_rate/notes/created_by.
--  2) authenticated — сузить SELECT-политику до «своя компания ИЛИ admin»
--     (чужие published-авто больше не видны authenticated вообще).
-- Публичный фронт (PublicPartsCustomerView: id,make,model,year,vin; маркет — через вьюху)
-- не ломается. Применяется вручную через Management API.

-- 1) anon: сброс всех грантов + только безопасные колонки
revoke select on public.parts_vehicles from anon;
grant select (
  id, parts_company_id, vin, make, model, year, color, engine, transmission,
  status, photo_url, photos, mileage, engine_type, transmission_type,
  created_at, updated_at, dismantling_started_at, dismantling_completed_at
) on public.parts_vehicles to anon;

-- 2) authenticated: убрать «OR published» — только своя компания или админ
drop policy if exists parts_vehicles_select on public.parts_vehicles;
create policy parts_vehicles_select on public.parts_vehicles
  for select to authenticated
  using (public.is_my_parts_company(parts_company_id) or public.is_admin());
