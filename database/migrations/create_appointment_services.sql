-- Создаем таблицу для хранения работ по заявке
-- Работы в Firebase хранились в поле description в виде текста с ценой

CREATE TABLE IF NOT EXISTS appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment ON appointment_services(appointment_id);

-- RLS политики (копируем логику от appointment_parts)
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_services_select_policy ON appointment_services;
CREATE POLICY appointment_services_select_policy ON appointment_services
  FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS appointment_services_insert_policy ON appointment_services;
CREATE POLICY appointment_services_insert_policy ON appointment_services
  FOR INSERT
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS appointment_services_update_policy ON appointment_services;
CREATE POLICY appointment_services_update_policy ON appointment_services
  FOR UPDATE
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS appointment_services_delete_policy ON appointment_services;
CREATE POLICY appointment_services_delete_policy ON appointment_services
  FOR DELETE
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Комментарии
COMMENT ON TABLE appointment_services IS 'Список работ по заявке';
COMMENT ON COLUMN appointment_services.description IS 'Описание работы';
COMMENT ON COLUMN appointment_services.cost IS 'Стоимость работы';
