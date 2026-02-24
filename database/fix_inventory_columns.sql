-- ============================================================================
-- Fix parts_inventory: add missing columns, make selling_price nullable
-- Run this in Supabase SQL editor if you get 400 errors on parts_inventory
-- ============================================================================

-- 1. Make selling_price nullable (was NOT NULL in original schema)
ALTER TABLE parts_inventory
  ALTER COLUMN selling_price DROP NOT NULL;

ALTER TABLE parts_inventory
  DROP CONSTRAINT IF EXISTS parts_inventory_selling_price_check;

ALTER TABLE parts_inventory
  ADD CONSTRAINT parts_inventory_selling_price_check
    CHECK (selling_price IS NULL OR selling_price >= 0);

-- 2. Add status column (available / reserved / sold / damaged)
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS status VARCHAR(50)
    NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'sold', 'damaged'));

-- 3. Add price_currency column
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) DEFAULT 'USD';

-- 4. Add photos column (JSONB array of ImgBB photo objects)
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 5. Add shelf/bin columns (legacy text storage fields)
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS shelf VARCHAR(100);

ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS bin VARCHAR(100);

-- 6. Add storage_location_id (added by add_warehouse.sql — safe to run again)
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS storage_location_id UUID
    REFERENCES parts_storage_locations(id) ON DELETE SET NULL;

-- 7. Drop old photo_url if you migrated to photos[] (optional, comment out if needed)
-- ALTER TABLE parts_inventory DROP COLUMN IF EXISTS photo_url;
