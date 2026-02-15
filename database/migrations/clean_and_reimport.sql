-- ПОЛНАЯ ОЧИСТКА И ПЕРЕИМПОРТ
-- Выполните этот скрипт ПЕРЕД импортом generated_import.sql

BEGIN;

-- 1. Удаляем ВСЕ связанные данные из Firebase импорта
DELETE FROM appointment_services
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE firebase_id IS NOT NULL
);

DELETE FROM appointment_parts
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE firebase_id IS NOT NULL
);

-- 2. Удаляем заявки из Firebase
DELETE FROM appointments WHERE firebase_id IS NOT NULL;

-- 3. Удаляем клиентов и автомобили из Firebase (если нужно полностью пересоздать)
-- Раскомментируйте если нужно:
-- DELETE FROM vehicles WHERE firebase_id IS NOT NULL;
-- DELETE FROM customers WHERE firebase_id IS NOT NULL;

COMMIT;

-- 4. Проверка что всё удалено
SELECT 
  'Заявок осталось' as check_type,
  COUNT(*) as count
FROM appointments WHERE firebase_id IS NOT NULL
UNION ALL
SELECT 
  'Запчастей осталось',
  COUNT(*)
FROM appointment_parts ap
WHERE NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = ap.appointment_id)
UNION ALL
SELECT 
  'Работ осталось',
  COUNT(*)
FROM appointment_services aps
WHERE NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = aps.appointment_id);

-- Если все значения = 0, можно импортировать generated_import.sql
