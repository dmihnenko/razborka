-- Откатываем closed_date к created_at для старых заявок
UPDATE appointments
SET closed_date = created_at
WHERE status = 'archived'
  AND closed_date = '2026-02-18 18:51:03.244633+00'
  AND created_at < '2026-02-01'
RETURNING id, created_at, closed_date;
