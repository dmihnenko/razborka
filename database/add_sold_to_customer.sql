-- Add sold_to_customer_id to parts_inventory so we can show buyer info on sold items
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS sold_to_customer_id UUID REFERENCES parts_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parts_inventory_sold_to_customer ON parts_inventory(sold_to_customer_id);
