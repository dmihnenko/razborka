-- ШАГ 1: Поиск ID вашего СТО и менеджера "mng"

-- 1.1 Найти все СТО компании
SELECT 
  id,
  name,
  created_at,
  is_active
FROM sto_companies
ORDER BY created_at DESC;

-- 1.2 Найти пользователя "mng" (менеджера)
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.sto_company_id,
  r.name as role_name
FROM user_profiles up
LEFT JOIN user_roles ur ON ur.user_id = up.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE up.full_name ILIKE '%mng%' 
   OR up.email ILIKE '%mng%'
ORDER BY up.created_at DESC;

-- 1.3 Альтернативный поиск - все работники СТО
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.sto_company_id,
  sc.name as company_name,
  r.name as role_name
FROM user_profiles up
LEFT JOIN sto_companies sc ON sc.id = up.sto_company_id
LEFT JOIN user_roles ur ON ur.user_id = up.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE up.sto_company_id IS NOT NULL
ORDER BY up.created_at DESC;

-- ПОСЛЕ ВЫПОЛНЕНИЯ ЭТИХ ЗАПРОСОВ:
-- Скопируйте ID вашего СТО и ID менеджера "mng"
-- Они понадобятся для следующих шагов
