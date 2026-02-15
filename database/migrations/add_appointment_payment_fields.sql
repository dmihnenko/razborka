-- Расширение таблицы appointments для восстановления из Firebase
-- Добавляем поля оплаты
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS parts_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS work_paid BOOLEAN DEFAULT FALSE;

-- Добавляем дополнительные поля из Firebase
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS request_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scheduled_time TEXT,
ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS parts_client_cost NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS ready_for_pickup BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS firebase_id TEXT;

-- Обновляем constraint для статусов (добавляем 'archived')
DO $$
BEGIN
  -- Удаляем старый constraint если существует
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_status_check' 
    AND conrelid = 'appointments'::regclass
  ) THEN
    ALTER TABLE appointments DROP CONSTRAINT appointments_status_check;
  END IF;
  
  -- Добавляем новый constraint с архивным статусом
  ALTER TABLE appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'archived'));
END $$;

-- Создаем таблицу для запчастей заявки
CREATE TABLE IF NOT EXISTS appointment_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL
);

-- Индекс для быстрого поиска запчастей по заявке
CREATE INDEX IF NOT EXISTS idx_appointment_parts_appointment_id 
ON appointment_parts(appointment_id);

-- Индекс для поиска по номеру заявки
CREATE INDEX IF NOT EXISTS idx_appointments_request_number 
ON appointments(request_number);

-- Индекс для фильтрации по назначенному сотруднику
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to 
ON appointments(assigned_to);

-- Триггер для автоматического перевода в архив
CREATE OR REPLACE FUNCTION auto_archive_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Если заявка завершена и всё оплачено - переводим в архив
  IF NEW.status = 'completed' 
     AND NEW.parts_paid = TRUE 
     AND NEW.work_paid = TRUE THEN
    NEW.status := 'archived';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
DROP TRIGGER IF EXISTS trigger_auto_archive_appointment ON appointments;
CREATE TRIGGER trigger_auto_archive_appointment
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_appointment();

-- Комментарии к полям
COMMENT ON COLUMN appointments.parts_paid IS 'Оплачены ли запчасти';
COMMENT ON COLUMN appointments.work_paid IS 'Оплачены ли работы';
COMMENT ON COLUMN appointments.request_number IS 'Уникальный номер заявки (например STO-245404-163)';
COMMENT ON COLUMN appointments.description IS 'Описание работ по заявке';
COMMENT ON COLUMN appointments.assigned_to IS 'Назначенный сотрудник';
COMMENT ON COLUMN appointments.assigned_to_name IS 'Имя назначенного сотрудника';
COMMENT ON COLUMN appointments.completed_at IS 'Дата и время завершения заявки';
COMMENT ON COLUMN appointments.scheduled_time IS 'Время записи (например 10:00)';
COMMENT ON COLUMN appointments.parts_cost IS 'Себестоимость запчастей';
COMMENT ON COLUMN appointments.parts_client_cost IS 'Цена запчастей для клиента';
COMMENT ON COLUMN appointments.ready_for_pickup IS 'Готова ли заявка к выдаче клиенту';
COMMENT ON COLUMN appointments.created_by IS 'Кто создал заявку';
COMMENT ON COLUMN appointments.firebase_id IS 'ID из Firebase (для отладки импорта)';
