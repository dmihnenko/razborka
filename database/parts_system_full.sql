-- Полная схема системы разборки
-- Выполнять после add_companies.sql

-- ============================================
-- 0. Удаление старых таблиц (если нужно пересоздать)
-- ============================================

-- Раскомментируйте следующие строки если нужно удалить старые таблицы:
-- DROP TABLE IF EXISTS parts_order_items CASCADE;
-- DROP TABLE IF EXISTS parts_orders CASCADE;
-- DROP TABLE IF EXISTS parts_inventory CASCADE;
-- DROP TABLE IF EXISTS parts_vehicles CASCADE;
-- DROP TABLE IF EXISTS parts_customers CASCADE;
-- DROP TABLE IF EXISTS parts_categories CASCADE;
-- DROP FUNCTION IF EXISTS generate_parts_order_number(UUID);
-- DROP FUNCTION IF EXISTS update_parts_order_timestamp();
-- DROP FUNCTION IF EXISTS update_parts_order_total();
-- DROP FUNCTION IF EXISTS complete_parts_order();

-- ============================================
-- 1. Таблицы базовых справочников
-- ============================================

-- Категории запчастей
CREATE TABLE IF NOT EXISTS parts_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_categories_company ON parts_categories(parts_company_id);

-- Клиенты разборки
CREATE TABLE IF NOT EXISTS parts_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  discount_percent DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_customers_company ON parts_customers(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_customers_phone ON parts_customers(phone);

-- ============================================
-- 2. Таблица автомобилей на разборку
-- ============================================

CREATE TABLE IF NOT EXISTS parts_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  vin VARCHAR(17),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  engine VARCHAR(100),
  transmission VARCHAR(100),
  status VARCHAR(50) DEFAULT 'awaiting_disassembly' CHECK (status IN ('awaiting_disassembly', 'in_progress', 'dismantled', 'disposed')),
  purchase_price DECIMAL(10, 2),
  purchase_date DATE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_vehicles_company ON parts_vehicles(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_vehicles_vin ON parts_vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_parts_vehicles_status ON parts_vehicles(status);

-- ============================================
-- 3. Таблица инвентаря (склад запчастей)
-- ============================================

CREATE TABLE IF NOT EXISTS parts_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES parts_categories(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES parts_vehicles(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  part_number VARCHAR(100),
  description TEXT,
  condition VARCHAR(50) DEFAULT 'used' CHECK (condition IN ('new', 'used', 'damaged')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  min_stock_level INTEGER DEFAULT 0,
  location VARCHAR(100),
  selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
  sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0),
  sold_price DECIMAL(10, 2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_inventory_company ON parts_inventory(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_category ON parts_inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_vehicle ON parts_inventory(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_part_number ON parts_inventory(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_quantity ON parts_inventory(quantity);

-- ============================================
-- 4. Таблицы заказов
-- ============================================

-- Заказы
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

CREATE INDEX IF NOT EXISTS idx_parts_orders_company ON parts_orders(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_customer ON parts_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_status ON parts_orders(status);
CREATE INDEX IF NOT EXISTS idx_parts_orders_date ON parts_orders(order_date DESC);

-- Позиции заказов
CREATE TABLE IF NOT EXISTS parts_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES parts_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES parts_inventory(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_sale DECIMAL(10, 2) NOT NULL CHECK (price_at_sale >= 0),
  subtotal DECIMAL(10, 2) NOT NULL GENERATED ALWAYS AS (quantity * price_at_sale) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_order_items_order ON parts_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_parts_order_items_inventory ON parts_order_items(inventory_item_id);

-- ============================================
-- 5. Функции и триггеры
-- ============================================

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

CREATE TRIGGER parts_order_complete
  AFTER UPDATE ON parts_orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION complete_parts_order();

-- ============================================
-- 6. RLS Политики (временно отключены)
-- ============================================

ALTER TABLE parts_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

-- Временно отключаем для упрощения разработки
ALTER TABLE parts_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Комментарии
-- ============================================

COMMENT ON TABLE parts_categories IS 'Категории запчастей для разборки';
COMMENT ON TABLE parts_customers IS 'Клиенты разборки';
COMMENT ON TABLE parts_vehicles IS 'Автомобили на разборку';
COMMENT ON TABLE parts_inventory IS 'Склад запчастей';
COMMENT ON TABLE parts_orders IS 'Заказы клиентов';
COMMENT ON TABLE parts_order_items IS 'Позиции заказов';
