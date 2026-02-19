-- Проверяем текущего пользователя и его parts_company_id
SELECT 
  id,
  email,
  parts_company_id,
  sto_company_id,
  full_name
FROM user_profiles
WHERE id = auth.uid();

-- Проверяем роли пользователя
SELECT 
  up.email,
  r.name as role_name,
  ur.is_primary
FROM user_profiles up
JOIN user_roles ur ON ur.user_id = up.id
JOIN roles r ON r.id = ur.role_id
WHERE up.id = auth.uid();
