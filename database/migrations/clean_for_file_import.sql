-- Полная очистка импортированных данных для повторного импорта

BEGIN;

DELETE FROM appointment_services
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

DELETE FROM appointment_parts
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

DELETE FROM appointments WHERE firebase_id IS NOT NULL;

COMMIT;

-- После выполнения этого скрипта:
-- 1. Скачайте файл generated_import.sql на компьютер
-- 2. В Supabase SQL Editor нажмите "Import SQL file"
-- 3. Выберите generated_import.sql
-- 4. Run
