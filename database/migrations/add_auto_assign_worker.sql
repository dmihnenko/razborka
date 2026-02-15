-- Автоматическое назначение заявок работникам
-- 1. Если работник один - автоматически назначаем на него
-- 2. При удалении работника - переназначаем его заявки

-- Функция для автоматического назначения заявки единственному работнику
CREATE OR REPLACE FUNCTION auto_assign_to_single_worker()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_count INTEGER;
  v_single_worker_id UUID;
  v_worker_name TEXT;
BEGIN
  -- Если заявка уже назначена, ничего не делаем
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Если нет sto_company_id, не можем назначить
  IF NEW.sto_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Считаем количество активных работников в этом СТО
  -- (исключаем владельцев, берем только работников)
  SELECT COUNT(*), MIN(up.id)
  INTO v_worker_count, v_single_worker_id
  FROM user_profiles up
  INNER JOIN user_roles ur ON up.id = ur.user_id
  INNER JOIN roles r ON ur.role_id = r.id
  WHERE up.sto_company_id = NEW.sto_company_id
    AND up.is_active = TRUE
    AND r.name = 'sto_worker';

  -- Если работник только один - автоматически назначаем на него
  IF v_worker_count = 1 THEN
    -- Получаем имя работника
    SELECT full_name INTO v_worker_name
    FROM user_profiles
    WHERE id = v_single_worker_id;

    NEW.assigned_to := v_single_worker_id;
    NEW.assigned_to_name := v_worker_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на INSERT и UPDATE appointments
DROP TRIGGER IF EXISTS trigger_auto_assign_worker ON appointments;
CREATE TRIGGER trigger_auto_assign_worker
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_single_worker();

-- Функция для переназначения заявок при деактивации/удалении работника
CREATE OR REPLACE FUNCTION reassign_appointments_on_worker_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_count INTEGER;
  v_single_worker_id UUID;
  v_worker_name TEXT;
BEGIN
  -- Проверяем был ли это работник и деактивирован ли он
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    
    -- Проверяем есть ли у него назначенные заявки
    IF EXISTS (
      SELECT 1 FROM appointments 
      WHERE assigned_to = OLD.id 
        AND status NOT IN ('archived', 'completed', 'cancelled')
    ) THEN
      
      -- Считаем активных работников в этом СТО (кроме деактивированного)
      SELECT COUNT(*), MIN(up.id)
      INTO v_worker_count, v_single_worker_id
      FROM user_profiles up
      INNER JOIN user_roles ur ON up.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE up.sto_company_id = OLD.sto_company_id
        AND up.is_active = TRUE
        AND up.id != OLD.id
        AND r.name = 'sto_worker';

      -- Если остался один работник - переназначаем на него
      IF v_worker_count = 1 THEN
        SELECT full_name INTO v_worker_name
        FROM user_profiles
        WHERE id = v_single_worker_id;

        UPDATE appointments
        SET 
          assigned_to = v_single_worker_id,
          assigned_to_name = v_worker_name
        WHERE assigned_to = OLD.id
          AND status NOT IN ('archived', 'completed', 'cancelled');
      ELSE
        -- Если работников 0 или больше 1 - снимаем назначение
        UPDATE appointments
        SET 
          assigned_to = NULL,
          assigned_to_name = NULL
        WHERE assigned_to = OLD.id
          AND status NOT IN ('archived', 'completed', 'cancelled');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на UPDATE user_profiles (деактивация работника)
DROP TRIGGER IF EXISTS trigger_reassign_on_worker_deactivation ON user_profiles;
CREATE TRIGGER trigger_reassign_on_worker_deactivation
  AFTER UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION reassign_appointments_on_worker_deactivation();

-- Функция для переназначения при полном удалении работника
CREATE OR REPLACE FUNCTION reassign_appointments_on_worker_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_count INTEGER;
  v_single_worker_id UUID;
  v_worker_name TEXT;
BEGIN
  -- Проверяем есть ли у удаляемого пользователя назначенные заявки
  IF EXISTS (
    SELECT 1 FROM appointments 
    WHERE assigned_to = OLD.id
      AND status NOT IN ('archived', 'completed', 'cancelled')
  ) THEN
    
    -- Считаем активных работников в этом СТО (кроме удаляемого)
    SELECT COUNT(*), MIN(up.id)
    INTO v_worker_count, v_single_worker_id
    FROM user_profiles up
    INNER JOIN user_roles ur ON up.id = ur.user_id
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE up.sto_company_id = OLD.sto_company_id
      AND up.is_active = TRUE
      AND up.id != OLD.id
      AND r.name = 'sto_worker';

    -- Если остался один работник - переназначаем на него
    IF v_worker_count = 1 THEN
      SELECT full_name INTO v_worker_name
      FROM user_profiles
      WHERE id = v_single_worker_id;

      UPDATE appointments
      SET 
        assigned_to = v_single_worker_id,
        assigned_to_name = v_worker_name
      WHERE assigned_to = OLD.id
        AND status NOT IN ('archived', 'completed', 'cancelled');
    ELSE
      -- Если работников 0 или больше 1 - снимаем назначение
      UPDATE appointments
      SET 
        assigned_to = NULL,
        assigned_to_name = NULL
      WHERE assigned_to = OLD.id
        AND status NOT IN ('archived', 'completed', 'cancelled');
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Триггер на DELETE user_profiles
DROP TRIGGER IF EXISTS trigger_reassign_on_worker_deletion ON user_profiles;
CREATE TRIGGER trigger_reassign_on_worker_deletion
  BEFORE DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION reassign_appointments_on_worker_deletion();

-- Комментарии
COMMENT ON FUNCTION auto_assign_to_single_worker() IS 
  'Автоматически назначает заявку на работника если он один в СТО';
COMMENT ON FUNCTION reassign_appointments_on_worker_deactivation() IS 
  'Переназначает заявки при деактивации работника';
COMMENT ON FUNCTION reassign_appointments_on_worker_deletion() IS 
  'Переназначает заявки при удалении работника';
