-- Убираем UNIQUE constraint на VIN в таблице vehicles
-- Это позволит одному автомобилю иметь нескольких владельцев (при продаже)

-- Проверяем существующие constraints на VIN
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'vehicles'::regclass
  AND contype = 'u';

-- Удаляем UNIQUE constraint на vin (если он существует)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'vehicles'::regclass 
    AND conname LIKE '%vin%'
  ) THEN
    ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_key;
  END IF;
END $$;

-- Проверка: constraint удален
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles' AND column_name = 'vin';

-- Теперь можно создавать несколько записей автомобилей с одинаковым VIN
-- Каждая запись будет привязана к своему владельцу (customer_id)
