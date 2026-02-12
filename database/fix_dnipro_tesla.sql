-- Исправление: перенос "Dnipro Tesla" из parts_companies в sto_companies

-- Проверяем текущее состояние
SELECT 'Current parts_companies:' as info;
SELECT id, name FROM parts_companies;

SELECT 'Current sto_companies:' as info;
SELECT id, name FROM sto_companies;

-- Копируем "Dnipro Tesla" в sto_companies с тем же ID
INSERT INTO sto_companies (id, name, address, phone, email, description, is_active, created_at, updated_at)
SELECT id, name, address, phone, email, description, is_active, created_at, updated_at
FROM parts_companies
WHERE name = 'Dnipro Tesla'
ON CONFLICT (id) DO NOTHING;

-- Удаляем из parts_companies
DELETE FROM parts_companies WHERE name = 'Dnipro Tesla';

-- Обновляем связи пользователей: переносим из parts_company_id в sto_company_id
UPDATE user_profiles
SET 
  sto_company_id = parts_company_id,
  parts_company_id = NULL
WHERE parts_company_id = '04b0fc0c-7dc1-4af0-9921-7f8e449ecebc';

-- Проверяем результат
SELECT 'After fix - sto_companies:' as info;
SELECT id, name FROM sto_companies;

SELECT 'After fix - parts_companies:' as info;
SELECT id, name FROM parts_companies;

SELECT 'Users with sto_company_id:' as info;
SELECT id, email, full_name, sto_company_id, parts_company_id FROM user_profiles WHERE sto_company_id IS NOT NULL OR parts_company_id IS NOT NULL;
