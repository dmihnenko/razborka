-- Удаление всех таблиц разборки для пересоздания
-- ВНИМАНИЕ: Это удалит все данные!

DROP TABLE IF EXISTS parts_order_items CASCADE;
DROP TABLE IF EXISTS parts_orders CASCADE;
DROP TABLE IF EXISTS parts_inventory CASCADE;
DROP TABLE IF EXISTS parts_vehicles CASCADE;
DROP TABLE IF EXISTS parts_customers CASCADE;
DROP TABLE IF EXISTS parts_categories CASCADE;

-- Удаление функций
DROP FUNCTION IF EXISTS generate_parts_order_number(UUID);
DROP FUNCTION IF EXISTS update_parts_order_timestamp();
DROP FUNCTION IF EXISTS update_parts_order_total();
DROP FUNCTION IF EXISTS complete_parts_order();
