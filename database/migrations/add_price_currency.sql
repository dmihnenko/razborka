-- ========================================
-- ДОБАВЛЕНИЕ ПОДДЕРЖКИ ВАЛЮТЫ ДЛЯ ЦЕН ЗАПЧАСТЕЙ
-- ========================================
-- Добавляет поле price_currency в parts_inventory
-- и price_at_sale_currency в parts_order_items.
-- Значение по умолчанию: 'UAH'

-- 1. Добавляем колонку валюты в таблицу запчастей
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) NOT NULL DEFAULT 'UAH';

-- 2. Добавляем ограничение CHECK
ALTER TABLE parts_inventory
  DROP CONSTRAINT IF EXISTS parts_inventory_price_currency_check;

ALTER TABLE parts_inventory
  ADD CONSTRAINT parts_inventory_price_currency_check
  CHECK (price_currency IN ('UAH', 'USD'));

-- 3. Добавляем колонку валюты в позиции заказов
ALTER TABLE parts_order_items
  ADD COLUMN IF NOT EXISTS price_at_sale_currency VARCHAR(3) NOT NULL DEFAULT 'UAH';

-- 4. Добавляем ограничение CHECK
ALTER TABLE parts_order_items
  DROP CONSTRAINT IF EXISTS parts_order_items_currency_check;

ALTER TABLE parts_order_items
  ADD CONSTRAINT parts_order_items_currency_check
  CHECK (price_at_sale_currency IN ('UAH', 'USD'));

-- Проверяем результат
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('parts_inventory', 'parts_order_items')
  AND column_name IN ('price_currency', 'price_at_sale_currency')
ORDER BY table_name, column_name;
