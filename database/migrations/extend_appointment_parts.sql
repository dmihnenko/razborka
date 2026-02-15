-- Расширяем таблицу appointment_parts для хранения детальной информации о запчастях
-- Добавляем поля: количество, стоимость закупки, стоимость для клиента

-- Добавляем поля
ALTER TABLE appointment_parts 
ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS store_cost NUMERIC,
ADD COLUMN IF NOT EXISTS client_cost NUMERIC;

-- Комментарии к полям
COMMENT ON COLUMN appointment_parts.quantity IS 'Количество единиц запчасти';
COMMENT ON COLUMN appointment_parts.store_cost IS 'Стоимость закупки запчасти';
COMMENT ON COLUMN appointment_parts.client_cost IS 'Стоимость для клиента';

-- Индекс для быстрого подсчета стоимости по заявке
CREATE INDEX IF NOT EXISTS idx_appointment_parts_costs ON appointment_parts(appointment_id, client_cost, store_cost);
