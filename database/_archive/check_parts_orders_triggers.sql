-- Проверяем триггеры на parts_orders
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'parts_orders';
