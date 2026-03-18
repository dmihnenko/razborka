-- ============================================================================
-- Fix order number generation: replace MAX()-based RPC with atomic counter table
-- Problem: SELECT MAX() + 1 is NOT atomic — two concurrent requests get the same
--          result → both try to insert the same order_number → 409 Conflict.
--          pg_advisory_xact_lock doesn't work reliably in Supabase (transaction pooler).
-- Solution: dedicated counter table + INSERT ... ON CONFLICT DO UPDATE ... RETURNING
--           This is a single atomic statement — guaranteed no race conditions.
-- Run this in Supabase SQL editor
-- ============================================================================

-- 1. Create counter table (one row per company)
CREATE TABLE IF NOT EXISTS parts_order_counter (
  parts_company_id UUID PRIMARY KEY REFERENCES parts_companies(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);

-- 2. Seed from existing orders so numbering continues correctly
INSERT INTO parts_order_counter (parts_company_id, last_number)
SELECT
  parts_company_id,
  COALESCE(MAX(
    CASE
      WHEN order_number ~ '^P-\d+$'
      THEN CAST(SUBSTRING(order_number FROM 3) AS BIGINT)
      ELSE 0
    END
  ), 0)
FROM parts_orders
GROUP BY parts_company_id
ON CONFLICT (parts_company_id) DO UPDATE
  SET last_number = EXCLUDED.last_number;

-- 3. Replace RPC with atomic counter increment
DROP FUNCTION IF EXISTS generate_parts_order_number(UUID);

CREATE OR REPLACE FUNCTION generate_parts_order_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number BIGINT;
BEGIN
  -- Atomic: increment counter and return new value in one statement
  INSERT INTO parts_order_counter (parts_company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (parts_company_id) DO UPDATE
    SET last_number = parts_order_counter.last_number + 1
  RETURNING last_number INTO next_number;

  RETURN 'P-' || LPAD(next_number::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO anon;
