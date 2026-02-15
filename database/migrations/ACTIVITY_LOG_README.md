# Настройка системы логирования

## Обзор

Система автоматически логирует все изменения в заявках и клиентах. Логи хранятся 60 дней и затем автоматически удаляются.

## Установка

### 1. Создание таблицы и триггеров

Загрузите и выполните файл `database/migrations/create_activity_log.sql` в Supabase SQL Editor:

```sql
-- Этот файл создаст:
-- ✅ Таблицу activity_logs
-- ✅ RLS политики
-- ✅ Индексы для быстрого поиска
-- ✅ Триггеры для автоматического логирования
-- ✅ Функцию для удаления старых логов
```

### 2. Настройка автоматического удаления (pg_cron)

В Supabase Dashboard перейдите в **Database** → **Extensions** и активируйте расширение `pg_cron`.

Затем выполните в SQL Editor:

```sql
-- Настройка cron job для удаления старых логов (каждый день в 2:00 ночи)
SELECT cron.schedule(
  'delete-old-activity-logs',  -- название задачи
  '0 2 * * *',                  -- cron выражение (каждый день в 2:00)
  $$SELECT delete_old_activity_logs()$$
);
```

### 3. Проверка настройки

```sql
-- Посмотреть все запланированные задачи
SELECT * FROM cron.job;

-- Проверить последние выполнения
SELECT * FROM cron.job_run_details 
WHERE jobname = 'delete-old-activity-logs' 
ORDER BY start_time DESC 
LIMIT 10;
```

## Что логируется

### Заявки (appointments)
- ✅ Создание новой заявки
- ✅ Изменение статуса
- ✅ Назначение работника
- ✅ Обновление оплаты (запчасти/работы)
- ✅ Архивирование
- ✅ Удаление

### Клиенты (customers)
- ✅ Добавление нового клиента
- ✅ Обновление информации
- ✅ Удаление клиента

## Структура лога

```typescript
interface ActivityLog {
  id: UUID
  sto_company_id: UUID          // ID компании СТО
  user_id: UUID                 // Кто сделал изменение
  user_name: string             // Имя пользователя
  user_email: string            // Email пользователя
  
  action_type:                  // Тип действия
    | 'created'                 // Создано
    | 'updated'                 // Обновлено
    | 'deleted'                 // Удалено
    | 'archived'                // В архив
    | 'restored'                // Восстановлено
    | 'status_changed'          // Изменен статус
    | 'assigned'                // Назначено
    | 'payment_updated'         // Обновлена оплата
  
  entity_type:                  // Тип сущности
    | 'appointment'             // Заявка
    | 'customer'                // Клиент
    | 'vehicle'                 // Автомобиль
    | 'user'                    // Пользователь
    | 'service'                 // Услуга
    | 'part'                    // Запчасть
  
  entity_id: UUID               // ID сущности
  entity_name: string           // Название для отображения
  description: string           // Человекочитаемое описание
  old_value: JSONB              // Старое значение (опционально)
  new_value: JSONB              // Новое значение (опционально)
  created_at: timestamp         // Когда произошло
}
```

## Просмотр логов

Пользователи могут просматривать логи на странице `/history` (кнопка "История" в дашборде).

Показывает:
- Что изменилось
- Кто внес изменения
- Когда это произошло
- Детали изменений (старое/новое значение)

## Политики безопасности (RLS)

- ✅ Владельцы и менеджеры СТО видят только логи своей компании
- ✅ Логи создаются автоматически через триггеры
- ✅ Пользователи не могут изменять или удалять логи вручную
- ✅ Удаление происходит только автоматически через cron job

## Добавление логирования для других сущностей

Чтобы добавить логирование для других таблиц (vehicles, services, parts), создайте аналогичную функцию и триггер:

```sql
-- Пример для таблицы vehicles
CREATE OR REPLACE FUNCTION log_vehicle_change()
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
    v_description := 'Добавлен автомобиль: ' || NEW.brand || ' ' || NEW.model;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'updated';
    v_description := 'Обновлен автомобиль: ' || NEW.brand || ' ' || NEW.model;
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'deleted';
    v_description := 'Удален автомобиль: ' || OLD.brand || ' ' || OLD.model;
  END IF;

  INSERT INTO activity_logs (
    sto_company_id, user_id, user_name, user_email,
    action_type, entity_type, entity_id, entity_name, description,
    old_value, new_value
  ) VALUES (
    v_sto_company_id, auth.uid(), v_user_name, v_user_email,
    v_action_type, 'vehicle', COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.brand || ' ' || NEW.model, OLD.brand || ' ' || OLD.model),
    v_description,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создание триггера
DROP TRIGGER IF EXISTS trigger_log_vehicle_changes ON vehicles;
CREATE TRIGGER trigger_log_vehicle_changes
  AFTER INSERT OR UPDATE OR DELETE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION log_vehicle_change();
```

## Мониторинг

### Проверить количество логов
```sql
SELECT COUNT(*) FROM activity_logs;
```

### Посмотреть последние 10 логов
```sql
SELECT 
  created_at,
  user_name,
  action_type,
  entity_type,
  description
FROM activity_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Статистика по типам действий
```sql
SELECT 
  action_type,
  COUNT(*) as count
FROM activity_logs
GROUP BY action_type
ORDER BY count DESC;
```

### Проверить старые логи (которые будут удалены)
```sql
SELECT 
  COUNT(*) as old_logs_count,
  MIN(created_at) as oldest_log
FROM activity_logs
WHERE created_at < NOW() - INTERVAL '60 days';
```

## Удаление логов вручную (при необходимости)

```sql
-- Удалить все логи старше 60 дней
SELECT delete_old_activity_logs();

-- Удалить все логи (осторожно!)
DELETE FROM activity_logs;

-- Удалить логи определенного пользователя
DELETE FROM activity_logs WHERE user_id = 'uuid-пользователя';
```

## Устранение неполадок

### Логи не создаются
1. Проверьте, что триггеры созданы:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE 'trigger_log_%';
```

2. Проверьте, что функции существуют:
```sql
SELECT * FROM pg_proc WHERE proname LIKE 'log_%_change';
```

### Cron job не работает
1. Проверьте, что расширение pg_cron включено:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Проверьте логи выполнения:
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

3. Проверьте, есть ли ошибки:
```sql
SELECT * FROM cron.job_run_details 
WHERE status = 'failed'
ORDER BY start_time DESC;
```

## Примечания

- 📌 Логи удаляются **только логи**, данные заявок/клиентов/автомобилей остаются нетронутыми
- 📌 По умолчанию хранятся последние 100 записей в UI (но в БД хранятся все за 60 дней)
- 📌 Время удаления можно изменить в функции `delete_old_activity_logs()`, изменив интервал
- 📌 Cron выражение можно настроить под свои нужды (например, `0 3 * * 0` = каждое воскресенье в 3:00)
