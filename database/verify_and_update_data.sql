-- Проверка и обновление существующих данных после миграции

-- 1. Проверяем структуру таблиц
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('vehicles', 'appointments')
  AND column_name IN ('sto_company_id', 'assigned_to', 'created_by')
ORDER BY table_name, column_name;

-- 2. Обновляем автомобили без sto_company_id
-- Присваиваем им sto_company_id из их клиентов
UPDATE vehicles v
SET sto_company_id = c.sto_company_id
FROM customers c
WHERE v.customer_id = c.id
  AND v.sto_company_id IS NULL
  AND c.sto_company_id IS NOT NULL;

-- 3. Проверяем результат обновления
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(v.sto_company_id) as with_company,
  COUNT(*) - COUNT(v.sto_company_id) as without_company
FROM vehicles v;

-- 4. Детальная проверка автомобилей
SELECT 
  v.id, 
  v.brand, 
  v.model,
  v.license_plate,
  c.name as customer_name,
  v.sto_company_id,
  sc.name as company_name
FROM vehicles v
LEFT JOIN customers c ON v.customer_id = c.id
LEFT JOIN sto_companies sc ON v.sto_company_id = sc.id
ORDER BY v.created_at DESC
LIMIT 10;

-- 5. Проверяем заявки
SELECT 
  COUNT(*) as total_appointments,
  COUNT(assigned_to) as with_assigned,
  COUNT(created_by) as with_creator
FROM appointments;

-- 6. Проверяем RLS политики
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('vehicles', 'appointments')
ORDER BY tablename, policyname;
