-- Проверка ролей пользователя d070988m@gmail.com

-- 1. Информация о пользователе
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
WHERE au.email = 'd070988m@gmail.com';

-- 2. Профиль пользователя
SELECT 
  up.id,
  up.first_name,
  up.last_name,
  up.full_name,
  up.created_at
FROM user_profiles up
WHERE up.id IN (SELECT id FROM auth.users WHERE email = 'd070988m@gmail.com');

-- 3. Роли пользователя через таблицу user_roles
SELECT 
  au.email,
  ur.user_id,
  ur.role_id,
  ur.is_primary,
  ur.assigned_at,
  r.name as role_name,
  r.description as role_description
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE au.email = 'd070988m@gmail.com';

-- 4. Список всех доступных ролей
SELECT id, name, description FROM roles ORDER BY name;
