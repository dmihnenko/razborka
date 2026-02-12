-- Проверка и исправление RLS политик для user_profiles

-- Смотрим текущие политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- Отключаем все существующие политики для user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to manage user_profiles" ON user_profiles;

-- Создаём простые политики для полного доступа аутентифицированных пользователей
CREATE POLICY "Allow all for authenticated users"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Проверяем результат
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
