-- Проверка импорта с ценами

-- 1. Общая статистика
SELECT 
  'Заявок импортировано' as metric,
  COUNT(*) as count
FROM appointments WHERE firebase_id IS NOT NULL
UNION ALL
SELECT 
  'Запчастей с ценами',
  COUNT(*) 
FROM appointment_parts 
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL)
  AND store_cost IS NOT NULL
UNION ALL
SELECT 
  'Работ импортировано',
  COUNT(*) 
FROM appointment_services
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

-- 2. Проверка конкретной запчасти "Тяга рулевая"
SELECT 
  a.request_number,
  ap.description,
  ap.quantity,
  ap.store_cost,
  ap.client_cost
FROM appointment_parts ap
JOIN appointments a ON ap.appointment_id = a.id
WHERE ap.description ILIKE '%тяга%рулевая%'
  AND a.firebase_id IS NOT NULL;

-- 3. Топ-5 заявок с запчастями
SELECT 
  a.request_number,
  COUNT(ap.id) as parts_count,
  SUM(ap.store_cost * ap.quantity) as total_parts_cost,
  COUNT(aps.id) as services_count,
  SUM(aps.cost) as total_services_cost
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.firebase_id IS NOT NULL
GROUP BY a.id, a.request_number
ORDER BY total_parts_cost DESC NULLS LAST
LIMIT 5;
