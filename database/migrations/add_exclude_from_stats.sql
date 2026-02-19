-- Добавляем поле для исключения заявки из статистики
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS exclude_from_stats BOOLEAN DEFAULT false;

-- Комментарий
COMMENT ON COLUMN appointments.exclude_from_stats IS 'Исключить заявку из статистики доходов';
