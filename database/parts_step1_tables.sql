-- Шаг 1: Создание базовых таблиц разборки
-- Выполнять ПОСЛЕ add_companies.sql

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

-- Автомобили на разборку
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

-- Склад запчастей
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

-- RLS (временно отключен)
ALTER TABLE parts_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE parts_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts_order_items DISABLE ROW LEVEL SECURITY;
