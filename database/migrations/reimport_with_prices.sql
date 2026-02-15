-- Пересоздание данных с правильными ценами
-- Выполнить в Supabase SQL Editor

BEGIN;

-- 1. Удаляем все импортированные запчасти и работы
DELETE FROM appointment_services
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE firebase_id IS NOT NULL
);

DELETE FROM appointment_parts
WHERE appointment_id IN (
  SELECT id FROM appointments WHERE firebase_id IS NOT NULL
);

-- 2. Удаляем все заявки из Firebase
DELETE FROM appointments WHERE firebase_id IS NOT NULL;

COMMIT;

-- 3. Теперь выполните новый импорт из generated_import.sql
-- Скопируйте содержимое generated_import.sql и выполните в SQL Editor
