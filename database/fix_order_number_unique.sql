-- ============================================================================
-- Fix order_number unique constraint: make it per-company instead of global
-- Problem: order_number TEXT UNIQUE means it's globally unique across ALL companies,
--          so two different companies can't both have P-000001 → 409 Conflict
-- Fix: drop global unique, add composite UNIQUE(parts_company_id, order_number)
-- Run this in Supabase SQL editor
-- ============================================================================

-- Drop the global unique constraint
ALTER TABLE parts_orders DROP CONSTRAINT IF EXISTS parts_orders_order_number_key;

-- Add composite unique constraint (per company)
ALTER TABLE parts_orders
  ADD CONSTRAINT parts_orders_order_number_company_unique
  UNIQUE (parts_company_id, order_number);

-- ============================================================================
-- Fix generate_parts_order_number RPC: add advisory lock to prevent race conditions
-- When two requests arrive simultaneously, both do SELECT MAX() and get the same
-- result → both try to insert the same order_number → 409 Conflict.
-- pg_advisory_xact_lock ensures only one transaction runs this at a time per company.
-- ============================================================================
DROP FUNCTION IF EXISTS generate_parts_order_number(UUID);

CREATE OR REPLACE FUNCTION generate_parts_order_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number BIGINT;
  result TEXT;
BEGIN
  -- Prevent race conditions: lock per company until transaction completes
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  SELECT COALESCE(
    MAX(
      CASE
        WHEN po.order_number ~ '^P-\d+$'
        THEN CAST(SUBSTRING(po.order_number FROM 3) AS BIGINT)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO next_number
  FROM parts_orders po
  WHERE po.parts_company_id = p_company_id;

  result := 'P-' || LPAD(next_number::TEXT, 6, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO anon;
