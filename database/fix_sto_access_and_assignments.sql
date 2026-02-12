-- Обновление логики доступа для СТО работников к заявкам и добавление sto_company_id к vehicles

-- 1. Добавляем sto_company_id к таблице vehicles, если его нет
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS sto_company_id UUID REFERENCES sto_companies(id) ON DELETE CASCADE;

-- Создаем индекс для производительности
CREATE INDEX IF NOT EXISTS idx_vehicles_sto_company ON vehicles(sto_company_id);

-- 2. Добавляем поля для назначения и создания заявок
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(created_by);

-- 3. Обновляем RLS политики для vehicles
DROP POLICY IF EXISTS "Allow authenticated users to read vehicles" ON vehicles;
CREATE POLICY "Allow authenticated users to read vehicles"
  ON vehicles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.sto_company_id = vehicles.sto_company_id OR user_profiles.sto_company_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicles" ON vehicles;
CREATE POLICY "Allow authenticated users to insert vehicles"
  ON vehicles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.sto_company_id = vehicles.sto_company_id
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to update vehicles" ON vehicles;
CREATE POLICY "Allow authenticated users to update vehicles"
  ON vehicles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.sto_company_id = vehicles.sto_company_id
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to delete vehicles" ON vehicles;
CREATE POLICY "Allow authenticated users to delete vehicles"
  ON vehicles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.sto_company_id = vehicles.sto_company_id
    )
  );

-- 4. Обновляем RLS политики для appointments с учетом assigned_to
DROP POLICY IF EXISTS "Allow authenticated users to read appointments" ON appointments;
CREATE POLICY "Allow authenticated users to read appointments"
  ON appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND up.sto_company_id = appointments.sto_company_id
      AND (
        -- Владелец СТО видит все заявки своей СТО
        r.name = 'sto_owner'
        OR 
        -- Работник видит только свои созданные или назначенные ему заявки
        (r.name = 'sto_worker' AND (
          appointments.created_by = auth.uid()
          OR appointments.assigned_to = auth.uid()
        ))
        OR
        -- Админ видит все
        r.name = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to insert appointments" ON appointments;
CREATE POLICY "Allow authenticated users to insert appointments"
  ON appointments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.sto_company_id = appointments.sto_company_id
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to update appointments" ON appointments;
CREATE POLICY "Allow authenticated users to update appointments"
  ON appointments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND up.sto_company_id = appointments.sto_company_id
      AND (
        r.name = 'sto_owner'
        OR 
        (r.name = 'sto_worker' AND (
          appointments.created_by = auth.uid()
          OR appointments.assigned_to = auth.uid()
        ))
        OR
        r.name = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Allow authenticated users to delete appointments" ON appointments;
CREATE POLICY "Allow authenticated users to delete appointments"
  ON appointments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND up.sto_company_id = appointments.sto_company_id
      AND (
        r.name = 'sto_owner'
        OR r.name = 'admin'
      )
    )
  );

-- Комментарии
COMMENT ON COLUMN vehicles.sto_company_id IS 'К какой СТО относится автомобиль';
COMMENT ON COLUMN appointments.assigned_to IS 'Кому назначена заявка (работник СТО)';
COMMENT ON COLUMN appointments.created_by IS 'Кто создал заявку';
