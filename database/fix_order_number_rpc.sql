-- ============================================================================
-- Fix generate_parts_order_number RPC
-- Fixes: INTEGER overflow when fallback timestamp-based order numbers exist (P-1702345678901)
-- Also fixes: variable name conflict with column "order_number" in PL/pgSQL scope
-- Run this in Supabase SQL editor
-- ============================================================================

-- Must drop first because parameter name is being changed (company_id → p_company_id)
DROP FUNCTION IF EXISTS generate_parts_order_number(UUID);

CREATE OR REPLACE FUNCTION generate_parts_order_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number BIGINT;
  result TEXT;
BEGIN
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
