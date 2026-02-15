-- Исправление кодировки для импортированных данных
-- Проблема: текст сохранен с двойной кодировкой (UTF-8 интерпретирован как Latin1)

BEGIN;

-- Проверяем проблему
SELECT 
  description,
  convert_from(convert_to(description, 'LATIN1'), 'UTF8') as fixed_description
FROM appointment_parts 
WHERE description LIKE '%Р%'
LIMIT 5;

-- Если видите правильный русский текст в fixed_description, выполните UPDATE:

-- Исправляем запчасти
UPDATE appointment_parts
SET description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE description LIKE '%Р%';

-- Исправляем работы
UPDATE appointment_services  
SET description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE description LIKE '%Р%';

-- Исправляем описания заявок
UPDATE appointments
SET description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE description LIKE '%Р%' AND firebase_id IS NOT NULL;

-- Исправляем имена клиентов
UPDATE customers
SET name = convert_from(convert_to(name, 'LATIN1'), 'UTF8')
WHERE name LIKE '%Р%' AND firebase_id IS NOT NULL;

COMMIT;

-- Проверка результата
SELECT description FROM appointment_parts LIMIT 10;
SELECT description FROM appointment_services LIMIT 10;
