-- Добавление поля assigned_to в work_orders для отслеживания работника
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Индекс для быстрого поиска заказов по работнику
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);

-- Комментарий
COMMENT ON COLUMN work_orders.assigned_to IS 'ID работника, назначенного на заказ-наряд';
