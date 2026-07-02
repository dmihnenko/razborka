-- Проверяем все колонки таблицы parts_orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'parts_orders'
ORDER BY ordinal_position;
