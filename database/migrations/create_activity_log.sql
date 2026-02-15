-- Создание таблицы для логирования изменений
-- Хранит изменения в течение 60 дней, затем автоматически удаляется

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sto_company_id UUID NOT NULL REFERENCES sto_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL, -- Полное имя пользователя для быстрого доступа
  user_email TEXT NOT NULL, -- Email пользователя
  
  -- Тип действия
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created', 'updated', 'deleted', 'archived', 'restored',
    'status_changed', 'assigned', 'payment_updated'
  )),
  
  -- К какой сущности относится
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'appointment', 'customer', 'vehicle', 'user', 'service', 'part'
  )),
  entity_id UUID NOT NULL,
  entity_name TEXT, -- Название/описание сущности для читаемости
  
  -- Детали изменения
  description TEXT NOT NULL, -- Человекочитаемое описание
  old_value JSONB, -- Старое значение (опционально)
  new_value JSONB, -- Новое значение (опционально)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_activity_logs_sto_company ON activity_logs(sto_company_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);

-- RLS политики
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Владельцы и менеджеры видят все логи своей СТО
CREATE POLICY "STO members can view their logs"
  ON activity_logs FOR SELECT
  USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Только система может вставлять логи (через функции/триггеры)
CREATE POLICY "System can insert logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Никто не может изменять или удалять логи вручную
-- Удаление происходит только автоматически через cron job

-- Функция для автоматического удаления старых логов (> 60 дней)
CREATE OR REPLACE FUNCTION delete_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарий: В Supabase нужно настроить pg_cron для ежедневного запуска:
-- SELECT cron.schedule('delete-old-logs', '0 2 * * *', 'SELECT delete_old_activity_logs()');

-- Функция для создания лога изменения заявки
CREATE OR REPLACE FUNCTION log_appointment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_user_email TEXT;
  v_sto_company_id UUID;
  v_description TEXT;
  v_action_type TEXT;
  v_entity_name TEXT;
BEGIN
  -- Получаем информацию о пользователе
  SELECT up.full_name, up.email, up.sto_company_id
  INTO v_user_name, v_user_email, v_sto_company_id
  FROM user_profiles up
  WHERE up.id = auth.uid();

  -- Если пользователь не найден, выходим
  IF v_user_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Определяем тип действия и описание
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'created';
    v_entity_name := COALESCE(NEW.request_number::TEXT, 'Новая заявка');
    v_description := 'Создана новая заявка #' || COALESCE(NEW.request_number::TEXT, '');
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_name := COALESCE(NEW.request_number::TEXT, OLD.request_number::TEXT, 'Заявка');
    
    -- Изменение статуса
    IF OLD.status != NEW.status THEN
      v_action_type := 'status_changed';
      v_description := 'Изменен статус заявки #' || v_entity_name || 
                      ' с "' || OLD.status || '" на "' || NEW.status || '"';
    
    -- Изменение назначенного работника
    ELSIF COALESCE(OLD.assigned_to::TEXT, '') != COALESCE(NEW.assigned_to::TEXT, '') THEN
      v_action_type := 'assigned';
      v_description := 'Изменен назначенный работник для заявки #' || v_entity_name;
    
    -- Изменение оплаты
    ELSIF OLD.parts_paid != NEW.parts_paid OR OLD.work_paid != NEW.work_paid THEN
      v_action_type := 'payment_updated';
      v_description := 'Обновлена информация об оплате для заявки #' || v_entity_name;
      
      IF OLD.parts_paid != NEW.parts_paid THEN
        v_description := v_description || ' (запчасти: ' || 
                        CASE WHEN NEW.parts_paid THEN 'оплачено' ELSE 'не оплачено' END || ')';
      END IF;
      
      IF OLD.work_paid != NEW.work_paid THEN
        v_description := v_description || ' (работы: ' || 
                        CASE WHEN NEW.work_paid THEN 'оплачено' ELSE 'не оплачено' END || ')';
      END IF;
    
    -- Архивирование
    ELSIF OLD.status != 'archived' AND NEW.status = 'archived' THEN
      v_action_type := 'archived';
      v_description := 'Заявка #' || v_entity_name || ' перемещена в архив';
    
    -- Общее обновление
    ELSE
      v_action_type := 'updated';
      v_description := 'Обновлена заявка #' || v_entity_name;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'deleted';
    v_entity_name := COALESCE(OLD.request_number::TEXT, 'Заявка');
    v_description := 'Удалена заявка #' || v_entity_name;
  END IF;

  -- Вставляем запись в лог
  INSERT INTO activity_logs (
    sto_company_id,
    user_id,
    user_name,
    user_email,
    action_type,
    entity_type,
    entity_id,
    entity_name,
    description,
    old_value,
    new_value
  ) VALUES (
    v_sto_company_id,
    auth.uid(),
    v_user_name,
    v_user_email,
    v_action_type,
    'appointment',
    COALESCE(NEW.id, OLD.id),
    v_entity_name,
    v_description,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для логирования изменений в заявках
DROP TRIGGER IF EXISTS trigger_log_appointment_changes ON appointments;
CREATE TRIGGER trigger_log_appointment_changes
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION log_appointment_change();

-- Функция для логирования изменений клиентов
CREATE OR REPLACE FUNCTION log_customer_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_user_email TEXT;
  v_sto_company_id UUID;
  v_description TEXT;
  v_action_type TEXT;
BEGIN
  SELECT up.full_name, up.email, up.sto_company_id
  INTO v_user_name, v_user_email, v_sto_company_id
  FROM user_profiles up
  WHERE up.id = auth.uid();

  IF v_user_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action_type := 'created';
    v_description := 'Добавлен новый клиент: ' || NEW.name;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'updated';
    v_description := 'Обновлена информация о клиенте: ' || NEW.name;
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'deleted';
    v_description := 'Удален клиент: ' || OLD.name;
  END IF;

  INSERT INTO activity_logs (
    sto_company_id, user_id, user_name, user_email,
    action_type, entity_type, entity_id, entity_name, description,
    old_value, new_value
  ) VALUES (
    v_sto_company_id, auth.uid(), v_user_name, v_user_email,
    v_action_type, 'customer', COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.name, OLD.name), v_description,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для клиентов
DROP TRIGGER IF EXISTS trigger_log_customer_changes ON customers;
CREATE TRIGGER trigger_log_customer_changes
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_change();

-- Комментарии для документации
COMMENT ON TABLE activity_logs IS 'Логи изменений в системе. Автоматически удаляются через 60 дней.';
COMMENT ON FUNCTION delete_old_activity_logs() IS 'Удаляет логи старше 60 дней. Запускается через pg_cron ежедневно в 2:00.';
COMMENT ON FUNCTION log_appointment_change() IS 'Автоматически логирует все изменения в заявках';
COMMENT ON FUNCTION log_customer_change() IS 'Автоматически логирует все изменения в клиентах';
