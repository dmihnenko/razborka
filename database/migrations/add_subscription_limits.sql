-- Добавляем поля лимитов и длительности в таблицу планов подписок
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS max_appointments INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_customers    INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_workers      INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_months  INT DEFAULT NULL;

-- Удаляем старые планы если есть, вставляем новые 5 тарифов для СТО
-- (безопасно — ON CONFLICT по name+company_type)
INSERT INTO subscriptions (name, description, price, type, company_type, is_active, max_appointments, max_customers, max_workers, duration_months)
VALUES
  (
    'Старт',
    'Базовый функционал для небольших СТО — 1 месяц',
    499, 'monthly', 'sto', true, 50, 100, 3, 1
  ),
  (
    'Бизнес',
    'Расширенный функционал для СТО среднего размера — 6 месяцев',
    2499, 'monthly', 'sto', true, 200, 500, 10, 6
  ),
  (
    'Профи',
    'Безлимитный функционал для крупных СТО — 12 месяцев',
    4499, 'yearly', 'sto', true, NULL, NULL, NULL, 12
  ),
  (
    'Навсегда',
    'Полный функционал без ограничений — бессрочная лицензия',
    9999, 'lifetime', 'sto', true, NULL, NULL, NULL, NULL
  )
ON CONFLICT DO NOTHING;

-- Для существующих планов типа 'monthly'/'yearly'/'lifetime' без лимитов — обновить разумными значениями
-- (UPDATE только там, где колонки ещё NULL и name соответствует)
UPDATE subscriptions SET max_appointments = 50,  max_customers = 100, max_workers = 3,  duration_months = 1  WHERE name ILIKE '%старт%'    AND company_type = 'sto' AND max_appointments IS NULL;
UPDATE subscriptions SET max_appointments = 200, max_customers = 500, max_workers = 10, duration_months = 6  WHERE name ILIKE '%бизнес%'   AND company_type = 'sto' AND max_appointments IS NULL;
UPDATE subscriptions SET duration_months = 12 WHERE name ILIKE '%профи%'    AND company_type = 'sto' AND duration_months IS NULL;
