# Инструкция по восстановлению заявок из Firebase бэкапа

## Обзор
Этот процесс восстанавливает 61 заявку из Firebase бэкапа `tsp-sto-export-2026-02-12.json` в базу данных Supabase.

## Шаги восстановления

### Шаг 1: Применить миграцию базы данных

Эта миграция добавляет все необходимые поля в таблицу `appointments` и создает таблицу `appointment_parts`.

```powershell
# Выполнить через Supabase Dashboard SQL Editor или через psql
psql -h [your-db-host] -U postgres -d postgres -f database/migrations/add_appointment_payment_fields.sql
```

**Что добавится:**
- ✅ Поля оплаты: `parts_paid`, `work_paid`
- ✅ Номер заявки: `request_number`
- ✅ Описание работ: `description`
- ✅ Назначенный сотрудник: `assigned_to`, `assigned_to_name`
- ✅ Даты: `completed_at`, `scheduled_time`
- ✅ Стоимость: `parts_cost`, `parts_client_cost`
- ✅ Флаги: `ready_for_pickup`
- ✅ Служебные: `created_by`, `firebase_id`
- ✅ Таблица `appointment_parts` для запчастей
- ✅ Автоматический триггер архивирования
- ✅ Новый статус: `archived`

### Шаг 2: Убедиться что клиенты и автомобили импортированы

Перед импортом заявок нужно импортировать клиентов и автомобили из того же JSON бэкапа.

**Проверить:**
```sql
-- Проверяем клиентов
SELECT COUNT(*) FROM customers;

-- Проверяем автомобили
SELECT COUNT(*) FROM vehicles;
```

Если клиентов и автомобилей нет - сначала их нужно импортировать (используйте скрипты из `import_step2_3_clients_vehicles.sql`).

### Шаг 3: Сгенерировать SQL для импорта

Запустите Node.js скрипт для генерации SQL из JSON:

```powershell
cd c:\Users\home\Documents\project\TSP-V2
node scripts/generate-import-sql.mjs
```

Скрипт создаст файл `database/migrations/generated_import.sql` с готовыми INSERT командами.

### Шаг 4: Подготовить данные для импорта

Откройте файл `generated_import.sql` и:

1. **Замените `YOUR_STO_USER_ID`** на ваш реальный UUID пользователя СТО:
   ```sql
   -- Найти ваш UUID:
   SELECT id FROM auth.users WHERE email = 'ваш@email.com';
   ```

2. **Проверьте маппинг клиентов и автомобилей**
   - Скрипт использует phone для поиска клиента
   - И VIN для поиска автомобиля
   - Убедитесь что они существуют в базе

### Шаг 5: Выполнить импорт

```powershell
# Через Supabase Dashboard SQL Editor
# Или через psql:
psql -h [your-db-host] -U postgres -d postgres -f database/migrations/generated_import.sql
```

### Шаг 6: Проверить результат

```sql
-- Сколько заявок импортировано
SELECT COUNT(*) FROM appointments;

-- Проверить статусы
SELECT status, COUNT(*) 
FROM appointments 
GROUP BY status;

-- Проверить оплаты
SELECT 
  COUNT(*) FILTER (WHERE parts_paid = TRUE) as parts_paid_count,
  COUNT(*) FILTER (WHERE work_paid = TRUE) as work_paid_count,
  COUNT(*) FILTER (WHERE status = 'archived') as archived_count
FROM appointments;

-- Проверить запчасти
SELECT COUNT(*) FROM appointment_parts;
```

## Маппинг статусов

| Firebase | Supabase | Описание |
|----------|----------|----------|
| "В работе" | `in_progress` | Заявка в процессе выполнения |
| "Активна" | `scheduled` | Заявка запланирована |
| "Выполнена" | `completed` | Работы завершены |
| "Архив" | `archived` | Заявка в архиве |
| "Запчасти оплачены" | `in_progress` | + parts_paid = true |

## Автоматическое архивирование

Триггер автоматически переводит заявку в статус `archived` когда:
- `status = 'completed'`
- `parts_paid = TRUE`
- `work_paid = TRUE`

## Массовое назначение заявок

Для владельца СТО будет добавлена функция массового назначения заявок сотруднику:

```sql
-- Назначить все незавершенные заявки одному сотруднику
UPDATE appointments 
SET 
  assigned_to = 'EMPLOYEE_USER_ID',
  assigned_to_name = 'Имя Сотрудника'
WHERE status IN ('scheduled', 'in_progress')
  AND assigned_to IS NULL;
```

## Структура данных

### appointments (расширенная таблица)
```
- id (UUID)
- created_at (TIMESTAMP)
- customer_id (UUID) → customers
- vehicle_id (UUID) → vehicles
- scheduled_date (TIMESTAMP)
- scheduled_time (TEXT)
- status (TEXT): scheduled, in_progress, completed, archived
- notes (TEXT)
+ request_number (TEXT UNIQUE) - номер заявки
+ description (TEXT) - описание работ
+ assigned_to (UUID) - назначенный сотрудник
+ assigned_to_name (TEXT) - имя сотрудника
+ completed_at (TIMESTAMP) - дата завершения
+ parts_paid (BOOLEAN) - оплачены запчасти
+ work_paid (BOOLEAN) - оплачена работа
+ parts_cost (NUMERIC) - себестоимость запчастей
+ parts_client_cost (NUMERIC) - цена для клиента
+ ready_for_pickup (BOOLEAN) - готова к выдаче
+ created_by (UUID) - кто создал
+ firebase_id (TEXT) - старый ID
```

### appointment_parts (новая таблица)
```
- id (UUID)
- created_at (TIMESTAMP)
- appointment_id (UUID) → appointments
- description (TEXT) - описание запчасти
```

## Troubleshooting

### Ошибка: клиент не найден
```sql
-- Проверить существует ли клиент с таким телефоном
SELECT * FROM customers WHERE phone = '380509298505';

-- Если нет - добавить вручную
INSERT INTO customers (name, phone) 
VALUES ('Имя Клиента', '380509298505');
```

### Ошибка: автомобиль не найден
```sql
-- Проверить существует ли автомобиль с таким VIN
SELECT * FROM vehicles WHERE vin = '4T1KZ1AK8PU085334';

-- Если нет - добавить вручную
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate)
VALUES (
  (SELECT id FROM customers WHERE phone = '380509298505'),
  'Toyota',
  'Camry',
  2024,
  '4T1KZ1AK8PU085334',
  'AA1234BB'
);
```

### Ошибка дублирования номера заявки
Скрипт использует `ON CONFLICT (request_number) DO NOTHING`, поэтому дубликаты будут пропущены.

## Следующие шаги

После импорта:
1. Проверить все заявки в UI
2. Распределить заявки между сотрудниками
3. Проверить корректность статусов и оплат
4. Убедиться что триггер архивирования работает

## Поддержка

Если возникли проблемы:
1. Проверьте логи Supabase
2. Запустите SQL проверки выше
3. Проверьте что все миграции применены
