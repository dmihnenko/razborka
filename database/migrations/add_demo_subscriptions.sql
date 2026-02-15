-- Создание демо-подписок и автоматическое назначение новым компаниям

-- 1. Добавляем демо-подписки
INSERT INTO subscriptions (name, type, price, company_type, description, is_active) VALUES
  ('Демо-подписка СТО', 'monthly', 0, 'sto', 'Бесплатная демо-подписка на 1 месяц для новых СТО', true),
  ('Демо-подписка разборки', 'monthly', 0, 'parts', 'Бесплатная демо-подписка на 1 месяц для новых разборок', true)
ON CONFLICT DO NOTHING;

-- 2. Функция для автоматического назначения демо-подписки СТО
CREATE OR REPLACE FUNCTION assign_demo_subscription_to_sto()
RETURNS TRIGGER AS $$
DECLARE
  demo_subscription_id UUID;
  end_date TIMESTAMPTZ;
BEGIN
  -- Получаем ID демо-подписки для СТО
  SELECT id INTO demo_subscription_id
  FROM subscriptions
  WHERE company_type = 'sto' 
    AND type = 'monthly' 
    AND price = 0 
    AND is_active = true
  LIMIT 1;

  -- Если нашли демо-подписку
  IF demo_subscription_id IS NOT NULL THEN
    -- Устанавливаем срок действия - 1 месяц от текущей даты
    end_date := NOW() + INTERVAL '1 month';
    
    -- Создаём запись о подписке
    INSERT INTO company_subscriptions (
      company_type,
      company_id,
      subscription_id,
      start_date,
      end_date,
      is_active
    ) VALUES (
      'sto',
      NEW.id,
      demo_subscription_id,
      NOW(),
      end_date,
      true
    );
    
    RAISE NOTICE 'Демо-подписка назначена СТО % до %', NEW.name, end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Функция для автоматического назначения демо-подписки разборке
CREATE OR REPLACE FUNCTION assign_demo_subscription_to_parts()
RETURNS TRIGGER AS $$
DECLARE
  demo_subscription_id UUID;
  end_date TIMESTAMPTZ;
BEGIN
  -- Получаем ID демо-подписки для разборки
  SELECT id INTO demo_subscription_id
  FROM subscriptions
  WHERE company_type = 'parts' 
    AND type = 'monthly' 
    AND price = 0 
    AND is_active = true
  LIMIT 1;

  -- Если нашли демо-подписку
  IF demo_subscription_id IS NOT NULL THEN
    -- Устанавливаем срок действия - 1 месяц от текущей даты
    end_date := NOW() + INTERVAL '1 month';
    
    -- Создаём запись о подписке
    INSERT INTO company_subscriptions (
      company_type,
      company_id,
      subscription_id,
      start_date,
      end_date,
      is_active
    ) VALUES (
      'parts',
      NEW.id,
      demo_subscription_id,
      NOW(),
      end_date,
      true
    );
    
    RAISE NOTICE 'Демо-подписка назначена разборке % до %', NEW.name, end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Создаём триггеры для автоматического назначения
DROP TRIGGER IF EXISTS trigger_assign_demo_to_sto ON sto_companies;
CREATE TRIGGER trigger_assign_demo_to_sto
  AFTER INSERT ON sto_companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_demo_subscription_to_sto();

DROP TRIGGER IF EXISTS trigger_assign_demo_to_parts ON parts_companies;
CREATE TRIGGER trigger_assign_demo_to_parts
  AFTER INSERT ON parts_companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_demo_subscription_to_parts();

-- Комментарии
COMMENT ON FUNCTION assign_demo_subscription_to_sto() IS 'Автоматически назначает демо-подписку на 1 месяц новым СТО';
COMMENT ON FUNCTION assign_demo_subscription_to_parts() IS 'Автоматически назначает демо-подписку на 1 месяц новым разборкам';

-- Проверка созданных подписок
SELECT id, name, type, price, company_type, description 
FROM subscriptions 
WHERE price = 0 
ORDER BY company_type;
