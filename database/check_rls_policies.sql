-- Проверка RLS политик для таблиц ролей

-- 1. Проверяем RLS на таблице roles
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('roles', 'user_roles');

-- 2. Проверяем политики на таблице roles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'roles';

-- 3. Проверяем политики на таблице user_roles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles';

-- 4. Тестовый запрос от имени текущего пользователя
-- Этот запрос покажет роли текущего залогиненного пользователя
SELECT 
  ur.user_id,
  ur.role_id,
  ur.is_primary,
  r.name as role_name,
  r.description
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = auth.uid();
