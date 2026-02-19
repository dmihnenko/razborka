-- Проверяем архивные заявки и их closed_date
SELECT 
  id,
  status,
  created_at,
  closed_date,
  parts_cost,
  total_parts_cost,
  total_work_cost,
  parts_paid,
  work_paid
FROM appointments
WHERE status = 'archived'
ORDER BY created_at DESC
LIMIT 10;
