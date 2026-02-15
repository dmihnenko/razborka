-- ============================================================================
-- Система шаблонов категорий запчастей
-- Владельцы могут создавать свои категории или использовать шаблоны
-- Администраторы создают глобальные шаблоны
-- ============================================================================

-- 1. Обновляем таблицу parts_categories - добавляем поддержку шаблонов
ALTER TABLE parts_categories ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE parts_categories ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) CHECK (template_type IN ('global', 'brand', 'brand_model', 'custom'));
ALTER TABLE parts_categories ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE parts_categories ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE parts_categories ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Индексы для быстрого поиска шаблонов
CREATE INDEX IF NOT EXISTS idx_parts_categories_template ON parts_categories(is_template, template_type);
CREATE INDEX IF NOT EXISTS idx_parts_categories_brand_model ON parts_categories(brand, model) WHERE is_template = true;

-- 2. Таблица для истории использования категорий при разборке
CREATE TABLE IF NOT EXISTS parts_vehicle_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parts_company_id UUID NOT NULL REFERENCES parts_companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES parts_vehicles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES parts_categories(id) ON DELETE CASCADE,
  
  -- Статистика использования
  items_count INT DEFAULT 0, -- Сколько деталей этой категории было снято
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parts_vehicle_categories_vehicle ON parts_vehicle_categories(vehicle_id);
CREATE INDEX idx_parts_vehicle_categories_company ON parts_vehicle_categories(parts_company_id);
CREATE INDEX idx_parts_vehicle_categories_category ON parts_vehicle_categories(category_id);

-- 3. Функция для получения рекомендуемых категорий на основе истории
CREATE OR REPLACE FUNCTION get_suggested_categories(
  p_parts_company_id UUID,
  p_brand VARCHAR,
  p_model VARCHAR
)
RETURNS TABLE (
  category_id UUID,
  category_name VARCHAR,
  usage_count BIGINT,
  source VARCHAR -- 'history', 'template', 'global'
) AS $$
BEGIN
  -- Возвращаем категории из истории этой компании для данной марки/модели
  RETURN QUERY
  SELECT DISTINCT
    pc.id,
    pc.name,
    COUNT(pvc.id) as usage_count,
    'history'::VARCHAR as source
  FROM parts_vehicle_categories pvc
  JOIN parts_categories pc ON pvc.category_id = pc.id
  JOIN parts_vehicles pv ON pvc.vehicle_id = pv.id
  WHERE pvc.parts_company_id = p_parts_company_id
    AND pv.brand = p_brand
    AND pv.model = p_model
    AND pv.status = 'dismantled'
  GROUP BY pc.id, pc.name
  
  UNION
  
  -- Шаблоны для конкретной марки и модели
  SELECT
    pc.id,
    pc.name,
    0 as usage_count,
    'template'::VARCHAR as source
  FROM parts_categories pc
  WHERE pc.is_template = true
    AND pc.template_type = 'brand_model'
    AND pc.brand = p_brand
    AND pc.model = p_model
    AND pc.is_active = true
  
  UNION
  
  -- Шаблоны для марки (без модели)
  SELECT
    pc.id,
    pc.name,
    0 as usage_count,
    'template'::VARCHAR as source
  FROM parts_categories pc
  WHERE pc.is_template = true
    AND pc.template_type = 'brand'
    AND pc.brand = p_brand
    AND pc.model IS NULL
    AND pc.is_active = true
  
  UNION
  
  -- Глобальные шаблоны
  SELECT
    pc.id,
    pc.name,
    0 as usage_count,
    'global'::VARCHAR as source
  FROM parts_categories pc
  WHERE pc.is_template = true
    AND pc.template_type = 'global'
    AND pc.is_active = true
  
  ORDER BY usage_count DESC, category_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Функция для копирования категорий из шаблона в рабочие категории компании
CREATE OR REPLACE FUNCTION copy_template_categories_to_company(
  p_parts_company_id UUID,
  p_template_ids UUID[]
)
RETURNS INT AS $$
DECLARE
  v_copied_count INT := 0;
  v_template_id UUID;
  v_new_category_id UUID;
BEGIN
  FOREACH v_template_id IN ARRAY p_template_ids
  LOOP
    -- Копируем категорию из шаблона
    INSERT INTO parts_categories (
      parts_company_id,
      name,
      parent_id,
      icon,
      color,
      sort_order,
      is_template,
      is_active
    )
    SELECT
      p_parts_company_id,
      name,
      NULL, -- parent_id сбрасываем, т.к. это копия для конкретной компании
      icon,
      color,
      sort_order,
      false, -- Рабочая категория, не шаблон
      true
    FROM parts_categories
    WHERE id = v_template_id
      AND is_template = true
    RETURNING id INTO v_new_category_id;
    
    IF v_new_category_id IS NOT NULL THEN
      v_copied_count := v_copied_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_copied_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Триггер для автоматического добавления записи в историю категорий
CREATE OR REPLACE FUNCTION track_category_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Когда добавляется новая деталь, регистрируем использование категории
  IF NEW.category_id IS NOT NULL AND NEW.source_vehicle_id IS NOT NULL THEN
    INSERT INTO parts_vehicle_categories (
      parts_company_id,
      vehicle_id,
      category_id,
      items_count
    )
    VALUES (
      NEW.parts_company_id,
      NEW.source_vehicle_id,
      NEW.category_id,
      1
    )
    ON CONFLICT (vehicle_id, category_id) 
    DO UPDATE SET items_count = parts_vehicle_categories.items_count + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Добавляем уникальный индекс для предотвращения дублей
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_vehicle_categories_unique 
  ON parts_vehicle_categories(vehicle_id, category_id);

DROP TRIGGER IF EXISTS trigger_track_category_usage ON parts_inventory;
CREATE TRIGGER trigger_track_category_usage
  AFTER INSERT ON parts_inventory
  FOR EACH ROW
  EXECUTE FUNCTION track_category_usage();

-- 6. Обновляем RLS политики для parts_categories с учетом шаблонов

DROP POLICY IF EXISTS "Parts company members can view their categories" ON parts_categories;
CREATE POLICY "Parts company members can view their categories"
  ON parts_categories FOR SELECT
  USING (
    -- Свои категории компании
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR 
    -- Шаблоны видны всем
    is_template = true
    OR 
    -- Глобальные категории (старые, без parts_company_id)
    parts_company_id IS NULL
  );

-- Администраторы могут создавать шаблоны
DROP POLICY IF EXISTS "Admins can create template categories" ON parts_categories;
CREATE POLICY "Admins can create template categories"
  ON parts_categories FOR INSERT
  WITH CHECK (
    -- Обычные пользователи создают для своей компании
    (
      parts_company_id IN (
        SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
      )
      AND (is_template = false OR is_template IS NULL)
    )
    OR
    -- Администраторы могут создавать шаблоны
    (
      is_template = true
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
      )
    )
  );

-- Обновление категорий
DROP POLICY IF EXISTS "Parts company members can update categories" ON parts_categories;
CREATE POLICY "Parts company members can update categories"
  ON parts_categories FOR UPDATE
  USING (
    -- Свои категории
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR
    -- Администраторы могут редактировать шаблоны
    (
      is_template = true
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
      )
    )
  );

-- Удаление категорий
DROP POLICY IF EXISTS "Parts company members can delete categories" ON parts_categories;
CREATE POLICY "Parts company members can delete categories"
  ON parts_categories FOR DELETE
  USING (
    -- Свои категории
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR
    -- Администраторы могут удалять шаблоны
    (
      is_template = true
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
      )
    )
  );

-- 7. RLS для parts_vehicle_categories
ALTER TABLE parts_vehicle_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parts company members can view their vehicle categories"
  ON parts_vehicle_categories FOR SELECT
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can manage vehicle categories"
  ON parts_vehicle_categories FOR ALL
  USING (
    parts_company_id IN (
      SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- 8. Обновляем глобальные категории - делаем их шаблонами
UPDATE parts_categories
SET 
  is_template = true,
  template_type = 'global'
WHERE parts_company_id IS NULL AND is_template IS NULL;

-- 9. Создаем дополнительные шаблоны для популярных марок

-- Шаблон для Toyota
INSERT INTO parts_categories (name, icon, color, sort_order, is_template, template_type, brand, is_active) VALUES
  ('Двигатель Toyota', 'engine', '#EF4444', 1, true, 'brand', 'Toyota', true),
  ('Кузов Toyota', 'car', '#F59E0B', 2, true, 'brand', 'Toyota', true),
  ('Электрика Toyota', 'zap', '#10B981', 3, true, 'brand', 'Toyota', true),
  ('Подвеска Toyota', 'settings', '#3B82F6', 4, true, 'brand', 'Toyota', true),
  ('Салон Toyota', 'layout', '#8B5CF6', 5, true, 'brand', 'Toyota', true)
ON CONFLICT DO NOTHING;

-- Шаблон для BMW
INSERT INTO parts_categories (name, icon, color, sort_order, is_template, template_type, brand, is_active) VALUES
  ('Двигатель BMW', 'engine', '#EF4444', 1, true, 'brand', 'BMW', true),
  ('Кузов BMW', 'car', '#F59E0B', 2, true, 'brand', 'BMW', true),
  ('Электроника BMW', 'zap', '#10B981', 3, true, 'brand', 'BMW', true),
  ('Подвеска BMW', 'settings', '#3B82F6', 4, true, 'brand', 'BMW', true)
ON CONFLICT DO NOTHING;

-- Шаблон для Mercedes-Benz
INSERT INTO parts_categories (name, icon, color, sort_order, is_template, template_type, brand, is_active) VALUES
  ('Двигатель Mercedes', 'engine', '#EF4444', 1, true, 'brand', 'Mercedes-Benz', true),
  ('Кузов Mercedes', 'car', '#F59E0B', 2, true, 'brand', 'Mercedes-Benz', true),
  ('Электроника Mercedes', 'zap', '#10B981', 3, true, 'brand', 'Mercedes-Benz', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- КОММЕНТАРИИ
-- ============================================================================

COMMENT ON COLUMN parts_categories.is_template IS 'Флаг, указывающий что это шаблон категории';
COMMENT ON COLUMN parts_categories.template_type IS 'Тип шаблона: global - для всех, brand - для марки, brand_model - для марки и модели, custom - пользовательский';
COMMENT ON COLUMN parts_categories.brand IS 'Марка автомобиля для шаблона (если template_type = brand или brand_model)';
COMMENT ON COLUMN parts_categories.model IS 'Модель автомобиля для шаблона (если template_type = brand_model)';

COMMENT ON TABLE parts_vehicle_categories IS 'История использования категорий при разборке автомобилей';
COMMENT ON FUNCTION get_suggested_categories(UUID, VARCHAR, VARCHAR) IS 'Возвращает рекомендуемые категории на основе истории и шаблонов';
COMMENT ON FUNCTION copy_template_categories_to_company(UUID, UUID[]) IS 'Копирует выбранные шаблоны категорий в рабочие категории компании';

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Система шаблонов категорий успешно создана:';
  RAISE NOTICE '';
  RAISE NOTICE 'Возможности:';
  RAISE NOTICE '- Владельцы могут создавать свои категории';
  RAISE NOTICE '- Использование шаблонов (глобальные, по маркам, по моделям)';
  RAISE NOTICE '- История категорий из ранее разобранных машин';
  RAISE NOTICE '- Администраторы создают шаблоны для всех';
  RAISE NOTICE '';
  RAISE NOTICE 'Функции:';
  RAISE NOTICE '- get_suggested_categories() - рекомендации категорий';
  RAISE NOTICE '- copy_template_categories_to_company() - копирование шаблонов';
  RAISE NOTICE '';
  RAISE NOTICE 'Создано шаблонов для марок: Toyota, BMW, Mercedes-Benz';
  RAISE NOTICE '=================================================================';
END $$;
