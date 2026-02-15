-- Исправление sto_company_id для импортированных заявок

-- 1. Проверка: есть ли у заявок sto_company_id?
SELECT 
  COUNT(*) FILTER (WHERE sto_company_id IS NULL) as without_company,
  COUNT(*) FILTER (WHERE sto_company_id IS NOT NULL) as with_company,
  COUNT(*) as total
FROM appointments
WHERE firebase_id IS NOT NULL;

-- 2. Проверка: какой sto_company_id есть в системе?
SELECT DISTINCT
  up.sto_company_id,
  sc.name as company_name
FROM user_profiles up
LEFT JOIN sto_companies sc ON up.sto_company_id = sc.id
WHERE up.sto_company_id IS NOT NULL
LIMIT 1;

-- 3. Обновление: привязываем все импортированные заявки к STO компании
BEGIN;

UPDATE appointments
SET sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
WHERE firebase_id IS NOT NULL;

COMMIT;

-- 4. Финальная проверка
SELECT 
  a.request_number,
  a.sto_company_id,
  sc.name as company_name
FROM appointments a
LEFT JOIN sto_companies sc ON a.sto_company_id = sc.id
WHERE a.firebase_id IS NOT NULL
LIMIT 5;
