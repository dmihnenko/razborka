-- ============================================================================
-- Склад (иерархические места хранения для разборки)
-- Пример: Бокс 1 → Стеллаж 4 → Полка 5 → Ячейка 7
-- ============================================================================

CREATE TABLE IF NOT EXISTS parts_storage_locations (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES parts_storage_locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INT  DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast children lookup
CREATE INDEX IF NOT EXISTS idx_storage_locations_parent ON parts_storage_locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_storage_locations_company ON parts_storage_locations(parts_company_id);

-- Add storage_location_id to parts_inventory
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS storage_location_id UUID
    REFERENCES parts_storage_locations(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE parts_storage_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parts_storage_locations_select" ON parts_storage_locations;
DROP POLICY IF EXISTS "parts_storage_locations_insert" ON parts_storage_locations;
DROP POLICY IF EXISTS "parts_storage_locations_update" ON parts_storage_locations;
DROP POLICY IF EXISTS "parts_storage_locations_delete" ON parts_storage_locations;

CREATE POLICY "parts_storage_locations_select" ON parts_storage_locations
  FOR SELECT USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "parts_storage_locations_insert" ON parts_storage_locations
  FOR INSERT WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "parts_storage_locations_update" ON parts_storage_locations
  FOR UPDATE USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "parts_storage_locations_delete" ON parts_storage_locations
  FOR DELETE USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
