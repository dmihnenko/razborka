-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Починка каталога услуг (мультитенант) + режим каталога + нормо-часы        ║
-- ║  Прод отставал: у service_categories / services не было sto_company_id /     ║
-- ║  parent_id, из-за чего select по sto_company_id давал 400, а вставка —       ║
-- ║  «Ошибка при сохранении». Идемпотентно, применять в Supabase → SQL editor.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1. Мультитенант: sto_company_id ──────────────────────────────────────────
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_service_categories_sto ON service_categories(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_services_sto ON services(sto_company_id);

-- ── 2. Иерархия категорий: parent_id ─────────────────────────────────────────
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES service_categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS service_categories_parent_id_idx ON service_categories(parent_id);

-- ── 3. Снимаем ГЛОБАЛЬНЫЙ unique на name (ломал мультитенант: две компании      ║
--       не могли завести категорию с одинаковым именем) ───────────────────────
ALTER TABLE service_categories DROP CONSTRAINT IF EXISTS service_categories_name_key;

-- ── 4. Нормо-часы у работ (идемпотентно, бэкфилл только если есть duration_minutes)
ALTER TABLE services ADD COLUMN IF NOT EXISTS norm_hours numeric(6,2);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'duration_minutes'
  ) THEN
    UPDATE services
      SET norm_hours = ROUND(duration_minutes::numeric / 60, 2)
      WHERE norm_hours IS NULL AND duration_minutes IS NOT NULL;
  END IF;
END $$;

-- ── 5. Режим каталога работ компании: 'price' | 'norm_hours' ──────────────────
ALTER TABLE sto_companies
  ADD COLUMN IF NOT EXISTS catalog_work_mode text DEFAULT 'price';
ALTER TABLE sto_companies
  ADD COLUMN IF NOT EXISTS labor_rate numeric(10,2) DEFAULT 0;
COMMENT ON COLUMN sto_companies.catalog_work_mode IS 'Форма каталога работ: price (цена) | norm_hours (нормо-часы × ставку)';

-- ── 6. RLS: доступ членам компании ───────────────────────────────────────────
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_select_policy ON service_categories;
DROP POLICY IF EXISTS service_categories_insert_policy ON service_categories;
DROP POLICY IF EXISTS service_categories_update_policy ON service_categories;
DROP POLICY IF EXISTS service_categories_delete_policy ON service_categories;
CREATE POLICY service_categories_all ON service_categories
  USING (sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS services_select_policy ON services;
DROP POLICY IF EXISTS services_insert_policy ON services;
DROP POLICY IF EXISTS services_update_policy ON services;
DROP POLICY IF EXISTS services_delete_policy ON services;
CREATE POLICY services_all ON services
  USING (sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()));

-- ── 7. Сброс кэша схемы PostgREST (чтобы 400 исчез сразу) ─────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'catalog fixed' AS status;
