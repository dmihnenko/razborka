-- ПОЛНАЯ ОЧИСТКА всех импортированных данных
-- Выполните ЭТО и БОЛЬШЕ НЕ ИМПОРТИРУЙТЕ generated_import.sql

BEGIN;

-- Удаляем ВСЁ что было импортировано из Firebase
DELETE FROM appointment_services
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

DELETE FROM appointment_parts
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

DELETE FROM appointments WHERE firebase_id IS NOT NULL;

-- Удаляем клиентов и автомобили (если они были созданы только для Firebase заявок)
-- Раскомментируйте если нужно:
-- DELETE FROM vehicles WHERE customer_id IN (SELECT id FROM customers WHERE firebase_id IS NOT NULL);
-- DELETE FROM customers WHERE firebase_id IS NOT NULL;

COMMIT;

-- Проверка что всё удалено
SELECT 
  (SELECT COUNT(*) FROM appointments WHERE firebase_id IS NOT NULL) as appointments,
  (SELECT COUNT(*) FROM appointment_parts WHERE appointment_id NOT IN (SELECT id FROM appointments)) as orphan_parts,
  (SELECT COUNT(*) FROM appointment_services WHERE appointment_id NOT IN (SELECT id FROM appointments)) as orphan_services;

-- Все значения должны быть 0
