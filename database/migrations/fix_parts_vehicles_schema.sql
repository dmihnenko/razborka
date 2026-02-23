-- ========================================
-- ИСПРАВЛЕНИЕ СХЕМЫ parts_vehicles
-- ========================================
-- Проблема: фронтенд использует status='awaiting', но в БД
-- ограничение CHECK требует 'awaiting_disassembly'.
-- Также добавляем недостающие колонки.

-- 1. Добавляем недостающие колонки
ALTER TABLE parts_vehicles
  ADD COLUMN IF NOT EXISTS mileage INTEGER,
  ADD COLUMN IF NOT EXISTS engine_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transmission_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dismantling_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismantling_completed_at TIMESTAMPTZ;

-- 2. Переносим данные из старых колонок в новые (если они существуют)
UPDATE parts_vehicles
SET
  engine_type = engine,
  transmission_type = transmission
WHERE engine IS NOT NULL OR transmission IS NOT NULL;

-- 3. Обновляем существующие записи: 'awaiting_disassembly' -> 'awaiting'
UPDATE parts_vehicles
SET status = 'awaiting'
WHERE status = 'awaiting_disassembly';

-- 4. Удаляем старое ограничение CHECK и добавляем новое
ALTER TABLE parts_vehicles
  DROP CONSTRAINT IF EXISTS parts_vehicles_status_check;

ALTER TABLE parts_vehicles
  ADD CONSTRAINT parts_vehicles_status_check
  CHECK (status IN ('awaiting', 'in_progress', 'dismantled', 'disposed'));

-- 5. Обновляем значение по умолчанию
ALTER TABLE parts_vehicles
  ALTER COLUMN status SET DEFAULT 'awaiting';

-- Проверяем результат
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'parts_vehicles'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS consrc
FROM pg_constraint
WHERE conrelid = 'parts_vehicles'::regclass
  AND contype = 'c';
