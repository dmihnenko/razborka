-- Добавление поля company_type в таблицу subscriptions
-- Это позволит различать планы для СТО и разборок

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS company_type VARCHAR(20) CHECK (company_type IN ('sto', 'parts'));

-- Обновление существующих записей на основе названия
UPDATE subscriptions 
SET company_type = 'sto'
WHERE name ILIKE '%сто%' AND company_type IS NULL;

UPDATE subscriptions 
SET company_type = 'parts'
WHERE name ILIKE '%разборк%' AND company_type IS NULL;

-- Сделать поле обязательным после заполнения данных
ALTER TABLE subscriptions 
ALTER COLUMN company_type SET NOT NULL;

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_type ON subscriptions(company_type, is_active);

COMMENT ON COLUMN subscriptions.company_type IS 'Тип компании: sto (СТО) или parts (разборка)';
