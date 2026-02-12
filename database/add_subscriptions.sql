-- Система подписок для СТО и Разборок

-- Типы подписок
CREATE TYPE subscription_type AS ENUM ('monthly', 'lifetime');

-- Таблица подписок
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type subscription_type NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица активных подписок компаний
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_type VARCHAR(20) NOT NULL CHECK (company_type IN ('sto', 'parts')),
  company_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ, -- NULL для бессрочных
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_type, company_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company ON company_subscriptions(company_type, company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_active ON company_subscriptions(is_active, end_date);

-- Функция для проверки активности подписки
CREATE OR REPLACE FUNCTION is_subscription_active(sub_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT * INTO sub_record
  FROM company_subscriptions
  WHERE id = sub_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Если бессрочная (end_date IS NULL) - активна
  IF sub_record.end_date IS NULL THEN
    RETURN true;
  END IF;
  
  -- Если временная - проверяем срок
  RETURN sub_record.end_date > NOW();
END;
$$ LANGUAGE plpgsql;

-- Вставка базовых подписок
INSERT INTO subscriptions (name, type, price, description) VALUES
  ('Месячная подписка СТО', 'monthly', 1200.00, 'Подписка на 1 месяц для СТО - неограниченное количество работников, заявок, клиентов и машин'),
  ('Бессрочная подписка СТО', 'lifetime', 15000.00, 'Бессрочная подписка для СТО - неограниченное количество работников, заявок, клиентов и машин'),
  ('Месячная подписка разборки', 'monthly', 1000.00, 'Подписка на 1 месяц для разборки - неограниченное количество работников, машин и запчастей'),
  ('Бессрочная подписка разборки', 'lifetime', 12000.00, 'Бессрочная подписка для разборки - неограниченное количество работников, машин и запчастей')
ON CONFLICT DO NOTHING;

-- RLS политики
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read subscriptions" ON subscriptions;
CREATE POLICY "Allow authenticated users to read subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin to manage subscriptions" ON subscriptions;
CREATE POLICY "Allow admin to manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read company_subscriptions" ON company_subscriptions;
CREATE POLICY "Allow authenticated users to read company_subscriptions"
  ON company_subscriptions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin to manage company_subscriptions" ON company_subscriptions;
CREATE POLICY "Allow admin to manage company_subscriptions"
  ON company_subscriptions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Комментарии
COMMENT ON TABLE subscriptions IS 'Типы подписок для СТО и разборок';
COMMENT ON TABLE company_subscriptions IS 'Активные подписки компаний';
COMMENT ON COLUMN company_subscriptions.company_type IS 'Тип компании: sto или parts';
COMMENT ON COLUMN company_subscriptions.end_date IS 'Дата окончания подписки (NULL для бессрочных)';
