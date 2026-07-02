-- Смотрим тело функции complete_parts_order
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'complete_parts_order';
