-- Добавляем поле is_active в таблицу services
ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Обновляем все существующие услуги как активные
UPDATE services
SET is_active = TRUE
WHERE is_active IS NULL;

-- Создаем индекс для быстрого поиска активных услуг
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
