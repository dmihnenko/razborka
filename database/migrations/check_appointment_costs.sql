-- Проверка данных о стоимости в заявках
SELECT 
  id,
  status,
  parts_cost,
  total_work_cost,
  (COALESCE(parts_cost, 0) + COALESCE(total_work_cost, 0)) as total,
  parts_paid,
  work_paid,
  closed_date
FROM appointments
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  AND status = 'archived'
ORDER BY closed_date DESC
LIMIT 10;

-- Общая статистика по стоимости
SELECT 
  status,
  COUNT(*) as count,
  SUM(COALESCE(parts_cost, 0)) as total_parts,
  SUM(COALESCE(total_work_cost, 0)) as total_work,
  SUM(COALESCE(parts_cost, 0) + COALESCE(total_work_cost, 0)) as total_revenue,
  COUNT(CASE WHEN parts_paid THEN 1 END) as parts_paid_count,
  COUNT(CASE WHEN work_paid THEN 1 END) as work_paid_count
FROM appointments
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
GROUP BY status;

-- Проверка связей с appointment_parts и appointment_services
SELECT 
  a.id,
  a.status,
  a.parts_cost,
  a.total_work_cost,
  COUNT(DISTINCT ap.id) as parts_count,
  COUNT(DISTINCT aps.id) as services_count,
  SUM(COALESCE(ap.store_cost, 0) * COALESCE(ap.quantity, 1)) as calculated_parts_cost,
  SUM(COALESCE(aps.cost, 0)) as calculated_services_cost
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  AND a.status = 'archived'
GROUP BY a.id, a.status, a.parts_cost, a.total_work_cost
ORDER BY a.closed_date DESC
LIMIT 10;
