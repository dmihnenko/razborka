-- Добавление UNIQUE constraints для импорта данных

-- Добавляем UNIQUE constraint на phone в customers
DO $$
BEGIN
  -- Проверяем есть ли constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_phone_key' 
    AND conrelid = 'customers'::regclass
  ) THEN
    -- Сначала обновляем дубликаты если есть
    WITH duplicates AS (
      SELECT phone, 
             FIRST_VALUE(id) OVER (PARTITION BY phone ORDER BY created_at) as keep_id
      FROM customers
      WHERE phone IS NOT NULL
    ),
    to_update AS (
      SELECT DISTINCT phone, keep_id
      FROM duplicates
      WHERE phone IN (
        SELECT phone FROM customers 
        WHERE phone IS NOT NULL 
        GROUP BY phone 
        HAVING COUNT(*) > 1
      )
    )
    UPDATE customers c
    SET phone = c.phone || '-' || c.id::text
    FROM to_update tu
    WHERE c.phone = tu.phone
      AND c.id != tu.keep_id;
    
    -- Добавляем constraint
    ALTER TABLE customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Добавляем UNIQUE constraint на vin в vehicles
DO $$
BEGIN
  -- Проверяем есть ли constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vehicles_vin_key' 
    AND conrelid = 'vehicles'::regclass
  ) THEN
    -- Сначала обновляем дубликаты если есть
    WITH duplicates AS (
      SELECT vin,
             FIRST_VALUE(id) OVER (PARTITION BY vin ORDER BY created_at) as keep_id
      FROM vehicles
      WHERE vin IS NOT NULL AND vin != ''
    ),
    to_update AS (
      SELECT DISTINCT vin, keep_id
      FROM duplicates
      WHERE vin IN (
        SELECT vin FROM vehicles 
        WHERE vin IS NOT NULL AND vin != ''
        GROUP BY vin 
        HAVING COUNT(*) > 1
      )
    )
    UPDATE vehicles v
    SET vin = v.vin || '-' || v.id::text
    FROM to_update tu
    WHERE v.vin = tu.vin
      AND v.id != tu.keep_id;
    
    -- Добавляем constraint
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_key UNIQUE (vin);
  END IF;
END $$;

-- Комментарии
COMMENT ON CONSTRAINT customers_phone_key ON customers IS 'Уникальный телефон клиента';
COMMENT ON CONSTRAINT vehicles_vin_key ON vehicles IS 'Уникальный VIN автомобиля';
