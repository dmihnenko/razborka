-- ============================================================================
-- Fix: allow deleting parts_inventory items that are referenced in orders
-- Behavior:
--   1. ON DELETE SET NULL — order item stays but inventory_item_id becomes NULL
--   2. Trigger recalculates order total (excludes items with NULL inventory)
--   3. If ALL items in the order become NULL → order is auto-deleted
-- ============================================================================

-- 1. Change FK from RESTRICT to SET NULL
ALTER TABLE parts_order_items
  DROP CONSTRAINT parts_order_items_inventory_item_id_fkey;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_inventory_item_id_fkey
  FOREIGN KEY (inventory_item_id)
  REFERENCES parts_inventory(id)
  ON DELETE SET NULL;

-- 2. Trigger function: recalculate total + auto-delete order if all items gone
CREATE OR REPLACE FUNCTION handle_order_item_inventory_deleted()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Recalculate order total using only items that still have inventory
  UPDATE parts_orders po
  SET total_amount = (
    SELECT COALESCE(SUM(
      CASE
        WHEN poi.price_at_sale_currency = 'USD'
        THEN poi.price_at_sale * poi.quantity * COALESCE(po.exchange_rate_at_sale, 41)
        ELSE poi.price_at_sale * poi.quantity
      END
    ), 0)
    FROM parts_order_items poi
    WHERE poi.order_id = NEW.order_id
      AND poi.inventory_item_id IS NOT NULL
  )
  WHERE po.id = NEW.order_id;

  -- Count items that still reference an inventory item
  SELECT COUNT(*) INTO active_count
  FROM parts_order_items
  WHERE order_id = NEW.order_id
    AND inventory_item_id IS NOT NULL;

  -- Auto-delete order if no active items remain
  IF active_count = 0 THEN
    DELETE FROM parts_orders WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_item_inventory_deleted ON parts_order_items;

CREATE TRIGGER trg_order_item_inventory_deleted
  AFTER UPDATE OF inventory_item_id ON parts_order_items
  FOR EACH ROW
  WHEN (OLD.inventory_item_id IS NOT NULL AND NEW.inventory_item_id IS NULL)
  EXECUTE FUNCTION handle_order_item_inventory_deleted();
