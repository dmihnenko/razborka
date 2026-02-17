-- Добавляем поле services_menu_enabled в таблицу sto_companies
-- Это поле контролирует доступ работников к меню услуг
ALTER TABLE sto_companies
ADD COLUMN IF NOT EXISTS services_menu_enabled BOOLEAN DEFAULT TRUE;

-- По умолчанию включаем для всех существующих СТО
UPDATE sto_companies
SET services_menu_enabled = TRUE
WHERE services_menu_enabled IS NULL;
