-- Проверяем что реально лежит в корзине
SELECT id, entity_type, entity_label, parts_company_id, sto_company_id, deleted_at
FROM public.trash_bin
ORDER BY deleted_at DESC
LIMIT 20;
