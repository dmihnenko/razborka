-- ============================================================================
-- CRM для Авторазборки - Структура базы данных
-- Полностью независимая от СТО система
-- ============================================================================

-- 1. Компании авторазборки
CREATE TABLE IF NOT EXISTS parts_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  
  -- Контактная информация
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  website VARCHAR(200),
  
  -- Настройки
  settings JSONB DEFAULT '{}',
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Поставщики автомобилей
CREATE TABLE IF NOT EXISTS parts_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('insurance', 'auction', 'individual', 'dealer', 'other')),
  
  -- Контакты
  contact_person VARCHAR(200),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  
  -- Условия работы
  payment_terms TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Автомобили на разборке
CREATE TABLE IF NOT EXISTS parts_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  
  -- Идентификация автомобиля
  vin VARCHAR(17),
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT,
  engine VARCHAR(50),
  transmission VARCHAR(50),
  body_type VARCHAR(50),
  color VARCHAR(50),
  mileage INT,
  
  -- Закупка
  supplier_id UUID REFERENCES parts_suppliers(id) ON DELETE SET NULL,
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  purchase_invoice VARCHAR(100),
  
  -- Статус разборки
  status VARCHAR(50) DEFAULT 'awaiting' CHECK (status IN (
    'awaiting',      -- Ожидает разборки
    'in_progress',   -- В процессе разборки
    'dismantled',    -- Разобрано
    'disposed'       -- Утилизировано
  )),
  
  -- Временные метки разборки
  started_dismantling_at TIMESTAMPTZ,
  completed_dismantling_at TIMESTAMPTZ,
  disposed_at TIMESTAMPTZ,
  
  -- Ответственный за разборку
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Финансы
  total_parts_value DECIMAL(10,2) DEFAULT 0, -- Общая стоимость полученных деталей
  total_sold DECIMAL(10,2) DEFAULT 0,        -- Уже продано на сумму
  profit DECIMAL(10,2) GENERATED ALWAYS AS (total_sold - COALESCE(purchase_price, 0)) STORED,
  
  -- Медиа
  photos TEXT[] DEFAULT '{}', -- Массив URL фото
  documents TEXT[] DEFAULT '{}', -- Документы (ПТС, договор и т.д.)
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Категории запчастей
CREATE TABLE IF NOT EXISTS parts_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID REFERENCES parts_companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES parts_categories(id) ON DELETE CASCADE,
  
  -- Настройки отображения
  icon VARCHAR(50),
  color VARCHAR(7),
  sort_order INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Каталог запчастей
CREATE TABLE IF NOT EXISTS parts_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  
  -- Идентификация детали
  name VARCHAR(200) NOT NULL,
  article VARCHAR(100),      -- Артикул производителя
  oem_number VARCHAR(100),   -- OEM номер
  category_id UUID REFERENCES parts_categories(id) ON DELETE SET NULL,
  
  -- Применимость (какой автомобиль)
  brand VARCHAR(100),
  model VARCHAR(100),
  year_from INT,
  year_to INT,
  engine VARCHAR(50),
  transmission VARCHAR(50),
  body_type VARCHAR(50),
  
  -- Исходный автомобиль
  source_vehicle_id UUID REFERENCES parts_vehicles(id) ON DELETE SET NULL,
  
  -- Состояние
  condition VARCHAR(50) DEFAULT 'good' CHECK (condition IN (
    'excellent',      -- Отличное
    'good',          -- Хорошее
    'fair',          -- Удовлетворительное
    'needs_repair',  -- Требует ремонта
    'for_parts'      -- На запчасти
  )),
  
  -- Складской учет
  quantity INT DEFAULT 1,
  reserved INT DEFAULT 0,              -- Зарезервировано под заказы
  available INT GENERATED ALWAYS AS (quantity - reserved) STORED,
  location VARCHAR(100),                -- Стеллаж/полка/ячейка
  
  -- Финансы
  cost_price DECIMAL(10,2),            -- Себестоимость
  selling_price DECIMAL(10,2) NOT NULL, -- Цена продажи
  
  -- Логистика
  weight DECIMAL(8,2),                 -- Вес в кг
  dimensions VARCHAR(50),              -- ДxШxВ в см
  
  -- Медиа и идентификация
  photos TEXT[] DEFAULT '{}',
  qr_code VARCHAR(100) UNIQUE,
  
  -- Дополнительно
  description TEXT,
  notes TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Заказы на запчасти
CREATE TABLE IF NOT EXISTS parts_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  order_number SERIAL,
  
  -- Клиент
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(100),
  
  -- Статус заказа
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN (
    'new',           -- Новый
    'confirmed',     -- Подтвержден
    'collected',     -- Собран
    'shipped',       -- Отправлен
    'delivered',     -- Доставлен
    'completed',     -- Завершен
    'cancelled'      -- Отменен
  )),
  
  -- Доставка
  delivery_method VARCHAR(50) CHECK (delivery_method IN ('pickup', 'delivery', 'courier', 'postal')),
  delivery_address TEXT,
  delivery_cost DECIMAL(10,2) DEFAULT 0,
  delivery_tracking VARCHAR(100),
  
  -- Оплата
  payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'card', 'transfer', 'online')),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
    'pending',       -- Ожидает оплаты
    'partial',       -- Частично оплачено
    'paid',          -- Оплачено
    'refunded'       -- Возвращено
  )),
  
  -- Суммы
  subtotal DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Ответственный менеджер
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  notes TEXT,
  internal_notes TEXT, -- Внутренние заметки (не видны клиенту)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- 7. Позиции заказа
CREATE TABLE IF NOT EXISTS parts_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES parts_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts_inventory(id) ON DELETE SET NULL,
  
  -- Данные на момент заказа (на случай если деталь удалена)
  part_name VARCHAR(200) NOT NULL,
  part_article VARCHAR(100),
  part_oem VARCHAR(100),
  
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ИНДЕКСЫ для оптимизации поиска
-- ============================================================================

-- Parts Companies
CREATE INDEX idx_parts_companies_active ON parts_companies(is_active);

-- Parts Suppliers
CREATE INDEX idx_parts_suppliers_company ON parts_suppliers(parts_company_id);
CREATE INDEX idx_parts_suppliers_active ON parts_suppliers(parts_company_id, is_active);

-- Parts Vehicles
CREATE INDEX idx_parts_vehicles_company ON parts_vehicles(parts_company_id);
CREATE INDEX idx_parts_vehicles_status ON parts_vehicles(parts_company_id, status);
CREATE INDEX idx_parts_vehicles_vin ON parts_vehicles(vin);
CREATE INDEX idx_parts_vehicles_brand_model ON parts_vehicles(brand, model);
CREATE INDEX idx_parts_vehicles_supplier ON parts_vehicles(supplier_id);
CREATE INDEX idx_parts_vehicles_assigned ON parts_vehicles(assigned_to);

-- Parts Categories
CREATE INDEX idx_parts_categories_company ON parts_categories(parts_company_id);
CREATE INDEX idx_parts_categories_parent ON parts_categories(parent_id);
CREATE INDEX idx_parts_categories_active ON parts_categories(parts_company_id, is_active);

-- Parts Inventory
CREATE INDEX idx_parts_inventory_company ON parts_inventory(parts_company_id);
CREATE INDEX idx_parts_inventory_active ON parts_inventory(parts_company_id, is_active);
CREATE INDEX idx_parts_inventory_category ON parts_inventory(category_id);
CREATE INDEX idx_parts_inventory_vehicle ON parts_inventory(source_vehicle_id);
CREATE INDEX idx_parts_inventory_article ON parts_inventory(article);
CREATE INDEX idx_parts_inventory_oem ON parts_inventory(oem_number);
CREATE INDEX idx_parts_inventory_brand_model ON parts_inventory(brand, model);
CREATE INDEX idx_parts_inventory_qr ON parts_inventory(qr_code);
CREATE INDEX idx_parts_inventory_name ON parts_inventory USING gin(to_tsvector('russian', name));

-- Parts Orders
CREATE INDEX idx_parts_orders_company ON parts_orders(parts_company_id);
CREATE INDEX idx_parts_orders_status ON parts_orders(parts_company_id, status);
CREATE INDEX idx_parts_orders_customer ON parts_orders(customer_id);
CREATE INDEX idx_parts_orders_created_by ON parts_orders(created_by);
CREATE INDEX idx_parts_orders_assigned ON parts_orders(assigned_to);
CREATE INDEX idx_parts_orders_number ON parts_orders(order_number);
CREATE INDEX idx_parts_orders_created_at ON parts_orders(created_at);

-- Parts Order Items
CREATE INDEX idx_parts_order_items_order ON parts_order_items(order_id);
CREATE INDEX idx_parts_order_items_part ON parts_order_items(part_id);

-- ============================================================================
-- RLS (Row Level Security) ПОЛИТИКИ
-- ============================================================================

-- Parts Companies
ALTER TABLE parts_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their company"
  ON parts_companies FOR SELECT
  USING (
    id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid() AND parts_company_id IS NOT NULL
    )
  );

CREATE POLICY "Parts company owners can update their company"
  ON parts_companies FOR UPDATE
  USING (
    id IN (
      SELECT up.parts_company_id 
      FROM user_profiles up
      JOIN user_roles ur ON up.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE up.id = auth.uid() 
        AND r.name = 'parts_owner'
        AND up.parts_company_id IS NOT NULL
    )
  );

-- Parts Suppliers
ALTER TABLE parts_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their suppliers"
  ON parts_suppliers FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can insert suppliers"
  ON parts_suppliers FOR INSERT
  WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can update suppliers"
  ON parts_suppliers FOR UPDATE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can delete suppliers"
  ON parts_suppliers FOR DELETE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Parts Vehicles
ALTER TABLE parts_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their vehicles"
  ON parts_vehicles FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can insert vehicles"
  ON parts_vehicles FOR INSERT
  WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can update vehicles"
  ON parts_vehicles FOR UPDATE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can delete vehicles"
  ON parts_vehicles FOR DELETE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Parts Categories
ALTER TABLE parts_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their categories"
  ON parts_categories FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR parts_company_id IS NULL -- Глобальные категории видны всем
  );

CREATE POLICY "Parts company members can manage categories"
  ON parts_categories FOR ALL
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Parts Inventory
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their inventory"
  ON parts_inventory FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can insert inventory"
  ON parts_inventory FOR INSERT
  WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can update inventory"
  ON parts_inventory FOR UPDATE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can delete inventory"
  ON parts_inventory FOR DELETE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Parts Orders
ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their orders"
  ON parts_orders FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can insert orders"
  ON parts_orders FOR INSERT
  WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can update orders"
  ON parts_orders FOR UPDATE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Parts company members can delete orders"
  ON parts_orders FOR DELETE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Parts Order Items
ALTER TABLE parts_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view order items"
  ON parts_order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM parts_orders WHERE parts_company_id IN (
        SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Parts company members can manage order items"
  ON parts_order_items FOR ALL
  USING (
    order_id IN (
      SELECT id FROM parts_orders WHERE parts_company_id IN (
        SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- КОММЕНТАРИИ для документации
-- ============================================================================

COMMENT ON TABLE parts_companies IS 'Компании авторазборки (независимо от СТО)';
COMMENT ON TABLE parts_suppliers IS 'Поставщики автомобилей для разборки';
COMMENT ON TABLE parts_vehicles IS 'Автомобили на складе разборки';
COMMENT ON TABLE parts_categories IS 'Категории запчастей';
COMMENT ON TABLE parts_inventory IS 'Каталог запчастей';
COMMENT ON TABLE parts_orders IS 'Заказы на запчасти';
COMMENT ON TABLE parts_order_items IS 'Позиции заказов';

COMMENT ON COLUMN parts_vehicles.status IS 'awaiting - ожидает, in_progress - разбирается, dismantled - разобран, disposed - утилизирован';
COMMENT ON COLUMN parts_inventory.condition IS 'excellent - отличное, good - хорошее, fair - среднее, needs_repair - требует ремонта, for_parts - на запчасти';
COMMENT ON COLUMN parts_orders.status IS 'new - новый, confirmed - подтвержден, collected - собран, shipped - отправлен, delivered - доставлен, completed - завершен, cancelled - отменен';
