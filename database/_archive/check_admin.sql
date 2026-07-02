-- Проверка профиля администратора

-- Проверяем существование пользователя
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'd070988m@gmail.com';

-- Проверяем профиль пользователя
SELECT up.*, r.name as role_name, r.display_name as role_display_name
FROM user_profiles up
LEFT JOIN roles r ON up.role_id = r.id
WHERE up.id IN (
  SELECT id FROM auth.users WHERE email = 'd070988m@gmail.com'
);

-- Проверяем все роли
SELECT * FROM roles ORDER BY name;
