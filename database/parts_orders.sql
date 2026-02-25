-- Таблица заказов для разборки
CREATE TABLE IF NOT EXISTS parts_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES parts_customers(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled')),
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Таблица позиций заказа
CREATE TABLE IF NOT EXISTS parts_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES parts_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES parts_inventory(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_sale DECIMAL(10, 2) NOT NULL CHECK (price_at_sale >= 0),
  price_at_sale_currency VARCHAR(3) NOT NULL DEFAULT 'UAH' CHECK (price_at_sale_currency IN ('UAH', 'USD')),
  subtotal DECIMAL(10, 2) NOT NULL GENERATED ALWAYS AS (quantity * price_at_sale) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_parts_orders_company ON parts_orders(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_customer ON parts_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_status ON parts_orders(status);
CREATE INDEX IF NOT EXISTS idx_parts_orders_date ON parts_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_parts_order_items_order ON parts_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_parts_order_items_inventory ON parts_order_items(inventory_item_id);

-- Функция для генерации номера заказа
CREATE OR REPLACE FUNCTION generate_parts_order_number(company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  -- Получить следующий номер для компании
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'P-(\d+)$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM parts_orders
  WHERE parts_company_id = company_id;
  
  -- Сформировать номер заказа
  order_number := 'P-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parts_order_number(UUID) TO anon;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_parts_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parts_orders_updated_at
  BEFORE UPDATE ON parts_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_order_timestamp();

-- Функция для обновления total_amount заказа при изменении позиций
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

CREATE TRIGGER parts_order_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON parts_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_order_total();

-- Функция для обновления инвентаря при завершении заказа
CREATE OR REPLACE FUNCTION complete_parts_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Если заказ переводится в статус 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Обновить количество в инвентаре для каждой позиции заказа
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
      
    -- Проверить, что количество не ушло в минус
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

CREATE TRIGGER parts_order_complete
  AFTER UPDATE ON parts_orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION complete_parts_order();

-- RLS политики (временно отключены, как и для других таблиц разборки)
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

-- Политики для владельцев компании (когда RLS будет включен)
CREATE POLICY parts_orders_company_policy ON parts_orders
  FOR ALL
  USING (
    parts_company_id IN (
      SELECT parts_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY parts_order_items_company_policy ON parts_order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT po.id 
      FROM parts_orders po
      JOIN user_profiles up ON up.parts_company_id = po.parts_company_id
      WHERE up.id = auth.uid()
    )
  );

-- Временно отключаем RLS
ALTER TABLE parts_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items DISABLE ROW LEVEL SECURITY;
