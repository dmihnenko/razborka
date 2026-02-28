-- Add exchange_rate_at_sale to parts_orders
-- Stores the USD/UAH rate at the moment the order was completed
-- This rate is fixed forever once the order is completed and should not change
ALTER TABLE parts_orders
  ADD COLUMN IF NOT EXISTS exchange_rate_at_sale DECIMAL(10, 4);

COMMENT ON COLUMN parts_orders.exchange_rate_at_sale IS
  'USD/UAH exchange rate fixed at the moment of order completion. Never changes after order is completed.';
