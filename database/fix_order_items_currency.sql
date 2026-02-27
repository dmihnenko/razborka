-- ============================================================================
-- Fix price_at_sale_currency in parts_order_items
-- When the column was added with DEFAULT 'UAH', existing rows got 'UAH'
-- even if the inventory item's price_currency is 'USD'.
-- This query corrects those rows.
-- Run this in Supabase SQL editor.
-- ============================================================================

-- Step 1: Add column if not exists (safe to run again)
ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS price_at_sale_currency VARCHAR(3) NOT NULL DEFAULT 'UAH'
    CHECK (price_at_sale_currency IN ('UAH', 'USD'));

-- Step 2: Fix existing rows — copy currency from the linked inventory item
UPDATE parts_order_items poi
SET price_at_sale_currency = pi.price_currency
FROM parts_inventory pi
WHERE poi.inventory_item_id = pi.id
  AND pi.price_currency = 'USD'
  AND poi.price_at_sale_currency = 'UAH';

-- Verify result
SELECT 
  poi.id,
  poi.price_at_sale,
  poi.price_at_sale_currency,
  pi.price_currency AS inventory_currency,
  pi.name AS item_name
FROM parts_order_items poi
JOIN parts_inventory pi ON poi.inventory_item_id = pi.id
ORDER BY poi.created_at DESC
LIMIT 20;
