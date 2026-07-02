-- Устанавливаем closed_date на сегодня только для заявок клиента "Мои авто"
UPDATE appointments
SET closed_date = '2026-02-18 18:51:03.244633+00'
WHERE id IN (
  'c6988cd0-2163-4dae-b139-420de378275d',
  '60e3014b-e624-4a33-8e12-db32f06c762c'
)
RETURNING id, created_at, closed_date, total_work_cost;
