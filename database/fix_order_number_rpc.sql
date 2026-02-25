-- ============================================================================
-- Fix generate_parts_order_number RPC: recreate with SECURITY DEFINER + GRANT
-- Run this in Supabase SQL editor if you get 400 on order creation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_parts_order_number(company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'P-(\d+)$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM parts_orders
  WHERE parts_company_id = company_id;

  order_number := 'P-' || LPAD(next_number::TEXT, 6, '0');
  RETURN order_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO anon;
