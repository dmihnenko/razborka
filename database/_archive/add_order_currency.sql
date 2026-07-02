-- Add price_at_sale_currency to parts_order_items if missing
ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS price_at_sale_currency VARCHAR(3) DEFAULT 'USD';
