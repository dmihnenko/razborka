-- Диагностика проблемы с ролями для d070988m@gmail.com

-- 1. Полная информация о пользователе и его ролях
SELECT 
  au.id as user_id,
  au.email,
  up.full_name,
  ur.role_id,
  ur.is_primary,
  r.name as role_name,
  r.description
FROM auth.users au
LEFT JOIN user_profiles up ON up.id = au.id
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE au.email = 'd070988m@gmail.com'
ORDER BY ur.is_primary DESC, r.name;

-- 2. Проверка: есть ли роль admin в таблице roles?
SELECT id, name, description FROM roles WHERE name = 'admin';

-- 3. Проверка: может ли текущий пользователь читать роли?
-- (выполнить залогинившись в приложении)
SELECT 
  ur.role_id,
  ur.is_primary,
  r.name,
  r.description
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = auth.uid();
