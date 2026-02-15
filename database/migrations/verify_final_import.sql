-- Финальная проверка импорта

-- 1. Общая статистика
SELECT 
  'Заявок' as тип,
  COUNT(*) as количество
FROM appointments WHERE firebase_id IS NOT NULL
UNION ALL
SELECT 'Запчастей', COUNT(*) 
FROM appointment_parts 
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL)
UNION ALL
SELECT 'Работ', COUNT(*) 
FROM appointment_services
WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);

-- 2. Проверка кодировки (должен быть русский текст)
SELECT 
  a.request_number,
  ap.description as запчасть,
  ap.store_cost as цена,
  aps.description as работа,
  aps.cost as стоимость_работы
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.firebase_id IS NOT NULL
LIMIT 5;

-- 3. Проверка что нет дубликатов
SELECT 
  a.request_number,
  COUNT(ap.id) as запчастей,
  COUNT(aps.id) as работ
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.firebase_id IS NOT NULL
GROUP BY a.request_number
ORDER BY запчастей DESC
LIMIT 5;

-- 4. Проверка sto_company_id
SELECT DISTINCT
  sto_company_id,
  COUNT(*) as заявок
FROM appointments
WHERE firebase_id IS NOT NULL
GROUP BY sto_company_id;
