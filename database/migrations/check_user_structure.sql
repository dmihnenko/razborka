-- Проверка структуры user_roles и поиск sto_owner

-- 1. Структура таблицы user_roles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles';

-- 2. Все записи user_roles
SELECT * FROM user_roles LIMIT 10;

-- 3. Все user_profiles с их STO компаниями
SELECT 
  up.id,
  up.full_name,
  up.sto_company_id,
  sc.name as company_name
FROM user_profiles up
LEFT JOIN sto_companies sc ON up.sto_company_id = sc.id
LIMIT 10;
