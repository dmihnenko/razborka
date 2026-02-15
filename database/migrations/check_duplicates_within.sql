-- Проверка на дубликаты внутри заявки

-- 1. Ищем дубликаты запчастей в одной заявке
SELECT 
  a.request_number,
  ap.description,
  COUNT(*) as duplicate_count,
  STRING_AGG(ap.id::text, ', ') as part_ids
FROM appointment_parts ap
JOIN appointments a ON ap.appointment_id = a.id
WHERE a.firebase_id IS NOT NULL
GROUP BY a.request_number, ap.description, ap.appointment_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- 2. Конкретные запчасти для STO-807425-845
SELECT 
  ap.description,
  ap.quantity,
  ap.store_cost,
  COUNT(*) OVER (PARTITION BY ap.description) as times_appears
FROM appointment_parts ap
JOIN appointments a ON ap.appointment_id = a.id
WHERE a.request_number = 'STO-807425-845'
ORDER BY ap.description;

-- 3. Работы для той же заявки
SELECT 
  aps.description,
  aps.cost,
  COUNT(*) OVER (PARTITION BY aps.description) as times_appears
FROM appointment_services aps
JOIN appointments a ON aps.appointment_id = a.id
WHERE a.request_number = 'STO-807425-845'
ORDER BY aps.description;
