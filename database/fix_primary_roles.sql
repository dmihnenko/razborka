-- Исправление is_primary для существующих пользователей
-- Устанавливаем is_primary = true для первой роли каждого пользователя, если ни одна роль не помечена как primary

-- Для каждого пользователя, у которого нет primary роли, устанавливаем первую роль как primary
WITH users_without_primary AS (
  SELECT DISTINCT user_id
  FROM user_roles ur1
  WHERE NOT EXISTS (
    SELECT 1 
    FROM user_roles ur2 
    WHERE ur2.user_id = ur1.user_id 
    AND ur2.is_primary = true
  )
),
first_roles AS (
  SELECT DISTINCT ON (user_id) 
    user_id, 
    role_id
  FROM user_roles
  WHERE user_id IN (SELECT user_id FROM users_without_primary)
  ORDER BY user_id, created_at ASC
)
UPDATE user_roles
SET is_primary = true
FROM first_roles
WHERE user_roles.user_id = first_roles.user_id
  AND user_roles.role_id = first_roles.role_id;

-- Проверяем результат
SELECT 
  up.email,
  up.full_name,
  r.display_name as role_name,
  ur.is_primary
FROM user_profiles up
JOIN user_roles ur ON up.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
ORDER BY up.email, ur.is_primary DESC;
