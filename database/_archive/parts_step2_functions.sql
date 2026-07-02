-- Шаг 2: Создание функций и триггеров
-- Выполнять ПОСЛЕ parts_step1_tables.sql

-- Функция для генерации номера заказа
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

-- Функция обновления updated_at для заказов
CREATE OR REPLACE FUNCTION update_parts_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parts_orders_updated_at ON parts_orders;
CREATE TRIGGER parts_orders_updated_at
  BEFORE UPDATE ON parts_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_order_timestamp();

-- Функция обновления total_amount при изменении позиций заказа
CREATE OR REPLACE FUNCTION update_parts_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE parts_orders
  SET total_amount = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM parts_order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parts_order_items_update_total ON parts_order_items;
CREATE TRIGGER parts_order_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON parts_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_order_total();

-- Функция завершения заказа (обновление инвентаря)
CREATE OR REPLACE FUNCTION complete_parts_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE parts_inventory pi
    SET 
      quantity = pi.quantity - poi.quantity,
      sold_quantity = COALESCE(pi.sold_quantity, 0) + poi.quantity,
      sold_price = CASE 
        WHEN pi.sold_price IS NULL THEN poi.price_at_sale
        ELSE pi.sold_price
      END
    FROM parts_order_items poi
    WHERE poi.order_id = NEW.id
      AND pi.id = poi.inventory_item_id;
      
    IF EXISTS (
      SELECT 1 FROM parts_inventory
      WHERE id IN (SELECT inventory_item_id FROM parts_order_items WHERE order_id = NEW.id)
        AND quantity < 0
    ) THEN
      RAISE EXCEPTION 'Недостаточно запчастей на складе для завершения заказа';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parts_order_complete ON parts_orders;
CREATE TRIGGER parts_order_complete
  AFTER UPDATE ON parts_orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION complete_parts_order();
