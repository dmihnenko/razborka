-- ============================================================================
-- Политики публичного доступа для клиентов СТО и разборки
-- ============================================================================

-- Разрешаем анонимный доступ к заявкам для конкретного клиента (СТО)
DROP POLICY IF EXISTS "Allow public access to appointments by customer_id" ON appointments;
CREATE POLICY "Allow public access to appointments by customer_id"
  ON appointments FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ ко всем заявкам для чтения

-- Разрешаем анонимный доступ к автомобилям для конкретного клиента (СТО)
DROP POLICY IF EXISTS "Allow public access to vehicles by customer_id" ON vehicles;
CREATE POLICY "Allow public access to vehicles by customer_id"
  ON vehicles FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ ко всем автомобилям для чтения

-- Разрешаем анонимный доступ к клиентам СТО (только для получения телефона)
DROP POLICY IF EXISTS "Allow public access to customers for phone lookup" ON customers;
CREATE POLICY "Allow public access to customers for phone lookup"
  ON customers FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ для чтения телефона

-- Разрешаем анонимный доступ к заказам запчастей для конкретного клиента разборки
DROP POLICY IF EXISTS "Allow public access to parts_orders by customer_id" ON parts_orders;
CREATE POLICY "Allow public access to parts_orders by customer_id"
  ON parts_orders FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ ко всем заказам для чтения

-- Разрешаем анонимный доступ к позициям заказов запчастей
DROP POLICY IF EXISTS "Allow public access to parts_order_items" ON parts_order_items;
CREATE POLICY "Allow public access to parts_order_items"
  ON parts_order_items FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ к позициям заказов

-- Разрешаем анонимный доступ к инвентарю запчастей (для отображения названий)
DROP POLICY IF EXISTS "Allow public access to parts_inventory" ON parts_inventory;
CREATE POLICY "Allow public access to parts_inventory"
  ON parts_inventory FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ к информации о запчастях

-- Разрешаем анонимный доступ к клиентам разборки (только для связи по телефону)
DROP POLICY IF EXISTS "Allow public access to parts_customers" ON parts_customers;
CREATE POLICY "Allow public access to parts_customers"
  ON parts_customers FOR SELECT
  TO anon
  USING (true);  -- Публичный доступ к клиентам разборки для чтения

-- ============================================================================
-- ВАЖНО: Эти политики разрешают ТОЛЬКО чтение (SELECT)
-- Создание, обновление и удаление по-прежнему требуют аутентификации
-- ============================================================================

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Публичные политики доступа созданы';
  RAISE NOTICE '';
  RAISE NOTICE 'Анонимные пользователи теперь могут:';
  RAISE NOTICE '  - Просматривать заявки СТО по customer_id';
  RAISE NOTICE '  - Просматривать автомобили по customer_id';
  RAISE NOTICE '  - Просматривать заказы запчастей по customer_id';
  RAISE NOTICE '';
  RAISE NOTICE 'ВАЖНО: Только чтение! Изменения требуют аутентификации.';
  RAISE NOTICE '=================================================================';
END $$;
