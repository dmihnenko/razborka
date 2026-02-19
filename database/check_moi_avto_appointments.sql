-- Проверяем заявки клиента "мои авто"
SELECT 
  a.id,
  a.status,
  a.created_at,
  a.closed_date,
  a.parts_cost,
  a.total_parts_cost,
  a.total_work_cost,
  a.parts_paid,
  a.work_paid,
  c.name as customer_name
FROM appointments a
JOIN customers c ON a.customer_id = c.id
WHERE LOWER(c.name) LIKE '%мои авто%'
  OR LOWER(c.name) LIKE '%мої авто%'
ORDER BY a.created_at DESC;
