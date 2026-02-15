-- Удаление дубликатов запчастей
-- Оставляем только уникальные записи по комбинации appointment_id + description

BEGIN;

-- Удаляем дубликаты запчастей, оставляя первую запись
DELETE FROM appointment_parts
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM appointment_parts
  GROUP BY appointment_id, description
);

-- Очищаем дубликаты работ (если есть)
DELETE FROM appointment_services
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM appointment_services
  GROUP BY appointment_id, description
);

COMMIT;

-- Проверка результата
SELECT 
  a.request_number,
  COUNT(ap.id) as parts_count,
  COUNT(DISTINCT ap.description) as unique_parts
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
WHERE a.firebase_id IS NOT NULL
GROUP BY a.request_number, a.id
HAVING COUNT(ap.id) > COUNT(DISTINCT ap.description)
ORDER BY a.request_number;
