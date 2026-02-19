-- Проверяем заявки, закрытые в феврале 2026
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
  AND closed_date >= '2026-02-01'
  AND closed_date < '2026-03-01'
ORDER BY closed_date DESC;
