-- Удаление дубликатов и записей с битой кодировкой

BEGIN;

-- 1. Удаляем записи с битой кодировкой (содержат РўРћ вместо ТО)
DELETE FROM appointment_parts
WHERE description LIKE '%Р%';

DELETE FROM appointment_services
WHERE description LIKE '%Р%';

DELETE FROM appointments
WHERE description LIKE '%Р%';

DELETE FROM customers
WHERE name LIKE '%Р%';

-- 2. Удаляем дубликаты (оставляем только первую запись для каждой комбинации)
DELETE FROM appointment_parts ap1
WHERE EXISTS (
  SELECT 1 FROM appointment_parts ap2
  WHERE ap1.appointment_id = ap2.appointment_id
    AND ap1.description = ap2.description
    AND ap1.id > ap2.id
);

DELETE FROM appointment_services aps1
WHERE EXISTS (
  SELECT 1 FROM appointment_services aps2
  WHERE aps1.appointment_id = aps2.appointment_id
    AND aps1.description = aps2.description
    AND aps1.id > aps2.id
);

COMMIT;

-- Проверка результата
SELECT 
  a.request_number,
  COUNT(ap.id) as parts_count,
  COUNT(aps.id) as services_count
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.firebase_id IS NOT NULL
GROUP BY a.request_number
ORDER BY parts_count DESC
LIMIT 5;
