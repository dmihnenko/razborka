-- Добавление таблиц для СТО и Разборок

-- Таблица СТО (станций технического обслуживания)
CREATE TABLE IF NOT EXISTS sto_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица Разборок (магазинов запчастей)
CREATE TABLE IF NOT EXISTS parts_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Добавление связей к таблице user_profiles
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parts_company_id UUID REFERENCES parts_companies(id) ON DELETE SET NULL;

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_profiles_sto_company ON user_profiles(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_parts_company ON user_profiles(parts_company_id);

-- Добавление sto_company_id к таблицам заявок
ALTER TABLE appointments 
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

-- Добавление parts_company_id к таблице запчастей
ALTER TABLE parts 
  ADD COLUMN IF NOT EXISTS parts_company_id UUID REFERENCES parts_companies(id) ON DELETE CASCADE;

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_appointments_sto_company ON appointments(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_sto_company ON work_orders(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_parts_parts_company ON parts(parts_company_id);

-- Включение RLS для новых таблиц
ALTER TABLE sto_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_companies ENABLE ROW LEVEL SECURITY;

-- Политики доступа для sto_companies
DROP POLICY IF EXISTS "Allow authenticated users to read sto_companies" ON sto_companies;
CREATE POLICY "Allow authenticated users to read sto_companies"
  ON sto_companies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage sto_companies" ON sto_companies;
CREATE POLICY "Allow authenticated users to manage sto_companies"
  ON sto_companies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Политики доступа для parts_companies
DROP POLICY IF EXISTS "Allow authenticated users to read parts_companies" ON parts_companies;
CREATE POLICY "Allow authenticated users to read parts_companies"
  ON parts_companies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage parts_companies" ON parts_companies;
CREATE POLICY "Allow authenticated users to manage parts_companies"
  ON parts_companies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Комментарии к таблицам
COMMENT ON TABLE sto_companies IS 'Станции технического обслуживания';
COMMENT ON TABLE parts_companies IS 'Разборки/магазины запчастей';
COMMENT ON COLUMN user_profiles.sto_company_id IS 'Привязка пользователя к СТО (для владельцев и работников СТО)';
COMMENT ON COLUMN user_profiles.parts_company_id IS 'Привязка пользователя к разборке (для владельцев и работников разборки)';
COMMENT ON COLUMN appointments.sto_company_id IS 'К какой СТО относится заявка';
COMMENT ON COLUMN work_orders.sto_company_id IS 'К какой СТО относится заказ-наряд';
COMMENT ON COLUMN parts.parts_company_id IS 'К какой разборке относится запчасть';
