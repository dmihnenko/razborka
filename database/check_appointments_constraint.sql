-- Проверяем актуальное состояние constraint на appointments.status
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'appointments'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
