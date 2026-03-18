-- Проверяем CHECK constraints на parts_orders
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'parts_orders'::regclass
  AND contype = 'c';
