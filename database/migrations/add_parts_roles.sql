-- ============================================================================
-- Роли и права доступа для Авторазборки
-- Независимая система ролей от СТО
-- ============================================================================

-- 1. Добавляем роли для авторазборки в таблицу roles
INSERT INTO roles (name, description) VALUES
  ('parts_owner', 'Владелец авторазборки - полный доступ ко всем функциям разборки'),
  ('parts_worker', 'Работник авторазборки - доступ к работе с заказами и складом')
ON CONFLICT (name) DO NOTHING;

-- 2. Обновляем user_profiles - добавляем поддержку parts_company_id
-- Проверяем, существует ли колонка, если нет - добавляем
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'parts_company_id'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN parts_company_id UUID REFERENCES parts_companies(id) ON DELETE CASCADE;
    
    -- Добавляем индекс для быстрого поиска
    CREATE INDEX idx_user_profiles_parts_company ON user_profiles(parts_company_id);
  END IF;
END $$;

-- 3. Обновляем RLS политики для user_profiles
-- Пользователи могут видеть профили коллег из своей разборки
DROP POLICY IF EXISTS "Users can view profiles from their parts company" ON user_profiles;
CREATE POLICY "Users can view profiles from their parts company"
  ON user_profiles FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR id = auth.uid()
  );

-- 4. Функция для автоматического создания компании разборки при регистрации владельца
CREATE OR REPLACE FUNCTION create_parts_company_on_owner_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_role_name TEXT;
  v_company_id UUID;
BEGIN
  -- Проверяем, является ли пользователь владельцем разборки
  SELECT r.name INTO v_role_name
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = NEW.id AND r.name = 'parts_owner';

  -- Если это владелец разборки и у него еще нет компании
  IF v_role_name = 'parts_owner' AND NEW.parts_company_id IS NULL THEN
    -- Создаем новую компанию разборки
    INSERT INTO parts_companies (name, email, phone)
    VALUES (
      COALESCE(NEW.full_name, NEW.email) || ' - Разборка',
      NEW.email,
      NEW.phone
    )
    RETURNING id INTO v_company_id;
    
    -- Привязываем пользователя к созданной компании
    NEW.parts_company_id = v_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания компании
DROP TRIGGER IF EXISTS trigger_create_parts_company ON user_profiles;
CREATE TRIGGER trigger_create_parts_company
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_parts_company_on_owner_registration();

-- 5. Функция для проверки прав доступа пользователя разборки
CREATE OR REPLACE FUNCTION check_parts_company_role(user_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN user_roles ur ON up.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE up.id = user_id
      AND r.name = required_role
      AND up.parts_company_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Обновляем политики parts_companies с учетом новых ролей
DROP POLICY IF EXISTS "Parts company owners can insert their company" ON parts_companies;
CREATE POLICY "Parts company owners can insert their company"
  ON parts_companies FOR INSERT
  WITH CHECK (
    check_parts_company_role(auth.uid(), 'parts_owner')
  );

-- 7. Ограничения для работников разборки
-- Работники могут просматривать, но некоторые операции только для владельца

-- Политика для удаления заказов (только владелец)
DROP POLICY IF EXISTS "Only parts owners can delete orders" ON parts_orders;
CREATE POLICY "Only parts owners can delete orders"
  ON parts_orders FOR DELETE
  USING (
    parts_company_id IN (
      SELECT up.parts_company_id 
      FROM user_profiles up
      JOIN user_roles ur ON up.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE up.id = auth.uid() 
        AND r.name = 'parts_owner'
    )
  );

-- Политика для удаления автомобилей (только владелец)
DROP POLICY IF EXISTS "Only parts owners can delete vehicles" ON parts_vehicles;
CREATE POLICY "Only parts owners can delete vehicles"
  ON parts_vehicles FOR DELETE
  USING (
    parts_company_id IN (
      SELECT up.parts_company_id 
      FROM user_profiles up
      JOIN user_roles ur ON up.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE up.id = auth.uid() 
        AND r.name = 'parts_owner'
    )
  );

-- 8. Вспомогательная функция для получения информации о текущем пользователе разборки
CREATE OR REPLACE FUNCTION get_current_parts_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT parts_company_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Триггер для автоматического заполнения parts_company_id при создании записей
CREATE OR REPLACE FUNCTION set_parts_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parts_company_id IS NULL THEN
    NEW.parts_company_id = get_current_parts_company_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер к таблицам
DROP TRIGGER IF EXISTS trigger_set_parts_company_suppliers ON parts_suppliers;
CREATE TRIGGER trigger_set_parts_company_suppliers
  BEFORE INSERT ON parts_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION set_parts_company_id();

DROP TRIGGER IF EXISTS trigger_set_parts_company_vehicles ON parts_vehicles;
CREATE TRIGGER trigger_set_parts_company_vehicles
  BEFORE INSERT ON parts_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION set_parts_company_id();

DROP TRIGGER IF EXISTS trigger_set_parts_company_inventory ON parts_inventory;
CREATE TRIGGER trigger_set_parts_company_inventory
  BEFORE INSERT ON parts_inventory
  FOR EACH ROW
  EXECUTE FUNCTION set_parts_company_id();

DROP TRIGGER IF EXISTS trigger_set_parts_company_orders ON parts_orders;
CREATE TRIGGER trigger_set_parts_company_orders
  BEFORE INSERT ON parts_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_parts_company_id();

-- ============================================================================
-- КОММЕНТАРИИ
-- ============================================================================

COMMENT ON FUNCTION create_parts_company_on_owner_registration() IS 'Автоматически создает компанию разборки при регистрации владельца';
COMMENT ON FUNCTION check_parts_company_role(UUID, TEXT) IS 'Проверяет наличие определенной роли у пользователя разборки';
COMMENT ON FUNCTION get_current_parts_company_id() IS 'Возвращает ID компании разборки текущего пользователя';
COMMENT ON FUNCTION set_parts_company_id() IS 'Автоматически заполняет parts_company_id при создании записей';

-- ============================================================================
-- ТЕСТОВЫЕ ДАННЫЕ (опционально, можно закомментировать)
-- ============================================================================

-- Создаем глобальные категории запчастей (доступны всем разборкам)
INSERT INTO parts_categories (parts_company_id, name, icon, color, sort_order) VALUES
  (NULL, 'Двигатель', 'engine', '#EF4444', 1),
  (NULL, 'Кузов', 'car', '#F59E0B', 2),
  (NULL, 'Электрика', 'zap', '#10B981', 3),
  (NULL, 'Подвеска', 'settings', '#3B82F6', 4),
  (NULL, 'Салон', 'layout', '#8B5CF6', 5),
  (NULL, 'Тормозная система', 'disc', '#EC4899', 6),
  (NULL, 'Трансмиссия', 'cog', '#6366F1', 7),
  (NULL, 'Оптика', 'lightbulb', '#F97316', 8),
  (NULL, 'Прочее', 'package', '#64748B', 9)
ON CONFLICT DO NOTHING;

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Роли для авторазборки успешно добавлены:';
  RAISE NOTICE '- parts_owner: Владелец разборки (полный доступ)';
  RAISE NOTICE '- parts_worker: Работник разборки (доступ к работе)';
  RAISE NOTICE '';
  RAISE NOTICE 'Обновления:';
  RAISE NOTICE '- Добавлено поле parts_company_id в user_profiles';
  RAISE NOTICE '- Созданы триггеры для автоматического заполнения данных';
  RAISE NOTICE '- Настроены RLS политики с разделением прав';
  RAISE NOTICE '- Добавлены глобальные категории запчастей';
  RAISE NOTICE '=================================================================';
END $$;
