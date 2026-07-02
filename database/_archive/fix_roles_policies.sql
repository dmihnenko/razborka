-- Исправление политик roles

-- Удаляем старые политики
DROP POLICY IF EXISTS "Allow all authenticated users to read roles" ON roles;
DROP POLICY IF EXISTS "Allow admins to manage roles" ON roles;

-- Создаем новые, простые политики
CREATE POLICY "Allow all authenticated users to read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
