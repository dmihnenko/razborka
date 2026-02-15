-- ============================================================================
-- Таблица клиентов РАЗБОРКИ (отдельная от клиентов СТО!)
-- parts_customers - ПОЛНОСТЬЮ НЕЗАВИСИМАЯ от customers (СТО)
-- ============================================================================

CREATE TABLE IF NOT EXISTS parts_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  
  -- Основная информация
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  
  -- Дополнительная информация
  notes TEXT,
  discount_percent DECIMAL(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  
  -- Статистика
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  
  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_parts_customers_company ON parts_customers(parts_company_id);
CREATE INDEX idx_parts_customers_phone ON parts_customers(phone);
CREATE INDEX idx_parts_customers_email ON parts_customers(email);
CREATE INDEX idx_parts_customers_name ON parts_customers(full_name);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_parts_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_parts_customers_updated_at ON parts_customers;
CREATE TRIGGER trigger_update_parts_customers_updated_at
  BEFORE UPDATE ON parts_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_customers_updated_at();

-- ============================================================================
-- RLS ПОЛИТИКИ
-- ============================================================================

ALTER TABLE parts_customers ENABLE ROW LEVEL SECURITY;

-- Просмотр клиентов своей компании
CREATE POLICY "Parts company members can view their customers"
  ON parts_customers FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Создание клиентов (владельцы и работники)
CREATE POLICY "Parts company members can create customers"
  ON parts_customers FOR INSERT
  WITH CHECK (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Обновление клиентов
CREATE POLICY "Parts company members can update customers"
  ON parts_customers FOR UPDATE
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Удаление клиентов (только владельцы)
CREATE POLICY "Parts owners can delete customers"
  ON parts_customers FOR DELETE
  USING (
    parts_company_id IN (
      SELECT up.parts_company_id 
      FROM user_profiles up
      JOIN user_roles ur ON up.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE up.id = auth.uid() 
        AND r.name = 'parts_owner'
    )
  );

-- ============================================================================
-- КОММЕНТАРИИ
-- ============================================================================

COMMENT ON TABLE parts_customers IS 'Клиенты авторазборки (ОТДЕЛЬНАЯ таблица от customers СТО)';
COMMENT ON COLUMN parts_customers.parts_company_id IS 'Компания разборки, которой принадлежит клиент';
COMMENT ON COLUMN parts_customers.discount_percent IS 'Персональная скидка клиента (0-100%)';
COMMENT ON COLUMN parts_customers.total_orders IS 'Общее количество заказов клиента';
COMMENT ON COLUMN parts_customers.total_spent IS 'Общая сумма покупок клиента';

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Таблица parts_customers создана';
  RAISE NOTICE '';
  RAISE NOTICE 'ВАЖНО: parts_customers - это ОТДЕЛЬНАЯ таблица клиентов разборки';
  RAISE NOTICE 'Она НИКАК не связана с customers (клиенты СТО)';
  RAISE NOTICE 'СТО и Разборка - две независимые сущности!';
  RAISE NOTICE '=================================================================';
END $$;
