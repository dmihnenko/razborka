-- Проверяем последние обновленные заявки
SELECT 
  id,
  status,
  created_at,
  updated_at,
  closed_date,
  parts_cost,
  total_parts_cost,
  total_work_cost,
  parts_paid,
  work_paid
FROM appointments
ORDER BY updated_at DESC
LIMIT 5;
