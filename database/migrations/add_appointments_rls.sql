-- Настройка Row Level Security для appointments и appointment_parts
-- Каждое СТО видит только свои заявки

-- Включаем RLS на appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Включаем RLS на appointment_parts
ALTER TABLE appointment_parts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ПОЛИТИКИ ДЛЯ APPOINTMENTS
-- ============================================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "appointments_select_policy" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_policy" ON appointments;
DROP POLICY IF EXISTS "appointments_update_policy" ON appointments;
DROP POLICY IF EXISTS "appointments_delete_policy" ON appointments;

-- SELECT: Пользователь видит только заявки своего СТО
CREATE POLICY "appointments_select_policy" ON appointments
  FOR SELECT
  USING (
    sto_company_id IN (
      SELECT sto_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- INSERT: Пользователь может создавать заявки только для своего СТО
CREATE POLICY "appointments_insert_policy" ON appointments
  FOR INSERT
  WITH CHECK (
    sto_company_id IN (
      SELECT sto_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- UPDATE: Пользователь может обновлять только заявки своего СТО
CREATE POLICY "appointments_update_policy" ON appointments
  FOR UPDATE
  USING (
    sto_company_id IN (
      SELECT sto_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    sto_company_id IN (
      SELECT sto_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- DELETE: Пользователь может удалять только заявки своего СТО
CREATE POLICY "appointments_delete_policy" ON appointments
  FOR DELETE
  USING (
    sto_company_id IN (
      SELECT sto_company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- ============================================================
-- ПОЛИТИКИ ДЛЯ APPOINTMENT_PARTS
-- ============================================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "appointment_parts_select_policy" ON appointment_parts;
DROP POLICY IF EXISTS "appointment_parts_insert_policy" ON appointment_parts;
DROP POLICY IF EXISTS "appointment_parts_update_policy" ON appointment_parts;
DROP POLICY IF EXISTS "appointment_parts_delete_policy" ON appointment_parts;

-- SELECT: Пользователь видит запчасти только своих заявок
CREATE POLICY "appointment_parts_select_policy" ON appointment_parts
  FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id 
        FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- INSERT: Пользователь может добавлять запчасти только к своим заявкам
CREATE POLICY "appointment_parts_insert_policy" ON appointment_parts
  FOR INSERT
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id 
        FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- UPDATE: Пользователь может обновлять запчасти только своих заявок
CREATE POLICY "appointment_parts_update_policy" ON appointment_parts
  FOR UPDATE
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id 
        FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id 
        FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- DELETE: Пользователь может удалять запчасти только своих заявок
CREATE POLICY "appointment_parts_delete_policy" ON appointment_parts
  FOR DELETE
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE sto_company_id IN (
        SELECT sto_company_id 
        FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- ПРОВЕРКА
-- ============================================================

-- Комментарии для документации
COMMENT ON POLICY "appointments_select_policy" ON appointments IS 
  'Пользователь видит только заявки своего СТО';
COMMENT ON POLICY "appointments_insert_policy" ON appointments IS 
  'Пользователь может создавать заявки только для своего СТО';
COMMENT ON POLICY "appointments_update_policy" ON appointments IS 
  'Пользователь может обновлять только заявки своего СТО';
COMMENT ON POLICY "appointments_delete_policy" ON appointments IS 
  'Пользователь может удалять только заявки своего СТО';

COMMENT ON POLICY "appointment_parts_select_policy" ON appointment_parts IS 
  'Пользователь видит запчасти только своих заявок';
COMMENT ON POLICY "appointment_parts_insert_policy" ON appointment_parts IS 
  'Пользователь может добавлять запчасти только к своим заявкам';
COMMENT ON POLICY "appointment_parts_update_policy" ON appointment_parts IS 
  'Пользователь может обновлять запчасти только своих заявок';
COMMENT ON POLICY "appointment_parts_delete_policy" ON appointment_parts IS 
  'Пользователь может удалять запчасти только своих заявок';
