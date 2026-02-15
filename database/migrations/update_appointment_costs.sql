-- Обновление parts_cost и total_work_cost на основе связанных таблиц

-- Шаг 1: Обновляем parts_cost
UPDATE appointments a
SET parts_cost = COALESCE(
  (
    SELECT SUM(COALESCE(ap.store_cost, 0) * COALESCE(ap.quantity, 1))
    FROM appointment_parts ap
    WHERE ap.appointment_id = a.id
  ), 
  0
)
WHERE a.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';

-- Шаг 2: Обновляем total_work_cost
UPDATE appointments a
SET total_work_cost = COALESCE(
  (
    SELECT SUM(COALESCE(aps.cost, 0))
    FROM appointment_services aps
    WHERE aps.appointment_id = a.id
  ), 
  0
)
WHERE a.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';

-- Проверка результатов
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

-- Детальная проверка для архивных заявок
SELECT 
  a.id,
  a.status,
  a.parts_cost,
  a.total_work_cost,
  (COALESCE(a.parts_cost, 0) + COALESCE(a.total_work_cost, 0)) as total,
  a.parts_paid,
  a.work_paid,
  COUNT(DISTINCT ap.id) as parts_count,
  COUNT(DISTINCT aps.id) as services_count
FROM appointments a
LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
WHERE a.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  AND a.status = 'archived'
GROUP BY a.id, a.status, a.parts_cost, a.total_work_cost, a.parts_paid, a.work_paid
ORDER BY a.closed_date DESC
LIMIT 10;
