-- Добавление поля closed_date если не существует
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS closed_date TIMESTAMP WITH TIME ZONE;

-- Проверка текущих статусов заявок
SELECT status, COUNT(*) as count
FROM appointments
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
GROUP BY status;

-- Проверка заявок без closed_date
SELECT COUNT(*) as archived_without_closed_date
FROM appointments
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  AND status = 'archived'
  AND closed_date IS NULL;

-- Обновление: установить closed_date для архивных заявок без этого поля
-- Используем scheduled_date как дату закрытия (или created_at если scheduled_date отсутствует)
UPDATE appointments
SET closed_date = COALESCE(scheduled_date, created_at)
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  AND status = 'archived'
  AND closed_date IS NULL;

-- Проверка результата
SELECT 
  status,
  COUNT(*) as total,
  COUNT(closed_date) as with_closed_date,
  MIN(closed_date) as earliest_closed,
  MAX(closed_date) as latest_closed
FROM appointments
WHERE sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
GROUP BY status;
