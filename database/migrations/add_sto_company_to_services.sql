-- Migration: привязка services и service_categories к конкретному СТО
-- Каждое СТО имеет свой независимый справочник услуг и категорий

-- 1. Добавляем sto_company_id в service_categories
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

-- 2. Добавляем sto_company_id в services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

-- 3. Индексы для быстрой выборки по компании
CREATE INDEX IF NOT EXISTS idx_service_categories_sto ON service_categories(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_services_sto ON services(sto_company_id);

-- 4. RLS для service_categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_select_policy ON service_categories;
CREATE POLICY service_categories_select_policy ON service_categories
  FOR SELECT USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_categories_insert_policy ON service_categories;
CREATE POLICY service_categories_insert_policy ON service_categories
  FOR INSERT WITH CHECK (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_categories_update_policy ON service_categories;
CREATE POLICY service_categories_update_policy ON service_categories
  FOR UPDATE USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_categories_delete_policy ON service_categories;
CREATE POLICY service_categories_delete_policy ON service_categories
  FOR DELETE USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- 5. RLS для services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_select_policy ON services;
CREATE POLICY services_select_policy ON services
  FOR SELECT USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS services_insert_policy ON services;
CREATE POLICY services_insert_policy ON services
  FOR INSERT WITH CHECK (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS services_update_policy ON services;
CREATE POLICY services_update_policy ON services
  FOR UPDATE USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS services_delete_policy ON services;
CREATE POLICY services_delete_policy ON services
  FOR DELETE USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Примечание: старые записи без sto_company_id станут недоступны через RLS.
-- Если нужно сохранить их для конкретной компании, выполните:
-- UPDATE services SET sto_company_id = '<your_sto_id>' WHERE sto_company_id IS NULL;
-- UPDATE service_categories SET sto_company_id = '<your_sto_id>' WHERE sto_company_id IS NULL;
