-- Исправление триггера auto_assign_to_single_worker
-- Убираем MIN(uuid) и просто берем первого работника через LIMIT 1

CREATE OR REPLACE FUNCTION auto_assign_to_single_worker()
RETURNS TRIGGER AS $$
DECLARE
  worker_count INTEGER;
  worker_id UUID;
  worker_name TEXT;
BEGIN
  -- Считаем активных работников в этой STO
  SELECT COUNT(*), up.id, up.full_name
  INTO worker_count, worker_id, worker_name
  FROM user_profiles up
  INNER JOIN user_roles ur ON up.id = ur.user_id
  INNER JOIN roles r ON ur.role_id = r.id
  WHERE up.sto_company_id = NEW.sto_company_id
    AND up.is_active = TRUE
    AND r.name = 'sto_worker'
  GROUP BY up.id, up.full_name
  LIMIT 1;

  -- Если ровно 1 работник - автоматически назначаем
  IF worker_count = 1 THEN
    NEW.assigned_to := worker_id;
    NEW.assigned_to_name := worker_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Пересоздаем триггер (на всякий случай)
DROP TRIGGER IF EXISTS trg_auto_assign_single_worker ON appointments;

CREATE TRIGGER trg_auto_assign_single_worker
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_single_worker();
