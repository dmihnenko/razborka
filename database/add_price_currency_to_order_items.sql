-- ============================================================================
-- Add price_at_sale_currency to parts_order_items
-- Run this in Supabase SQL editor
-- ============================================================================

ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS price_at_sale_currency VARCHAR(3) NOT NULL DEFAULT 'UAH'
    CHECK (price_at_sale_currency IN ('UAH', 'USD'));
