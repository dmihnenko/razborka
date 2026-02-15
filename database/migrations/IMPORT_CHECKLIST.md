# ✅ Готовность к импорту заявок из Firebase

## 📊 Статистика

- **Всего заявок в бэкапе:** 61
- **Готово к импорту:** 53 заявки
- **Пропущено:** 8 заявок (нет телефона клиента или VIN)
- **Ошибок генерации:** 0

## 🎯 Что сделано

### 1. ✅ Миграция базы данных
**Файл:** `database/migrations/add_appointment_payment_fields.sql`

**Добавлено в таблицу appointments:**
- `parts_paid` BOOLEAN - оплачены запчасти
- `work_paid` BOOLEAN - оплачена работа
- `request_number` TEXT UNIQUE - уникальный номер заявки
- `description` TEXT - описание работ
- `assigned_to` UUID - назначенный сотрудник (ссылка на auth.users)
- `assigned_to_name` TEXT - имя сотрудника
- `completed_at` TIMESTAMP - дата завершения
- `scheduled_time` TEXT - время записи
- `parts_cost` NUMERIC - себестоимость запчастей
- `parts_client_cost` NUMERIC - цена для клиента
- `ready_for_pickup` BOOLEAN - готова к выдаче
- `created_by` UUID - кто создал
- `firebase_id` TEXT - ID из Firebase

**Создана таблица appointment_parts:**
- `id` UUID PRIMARY KEY
- `created_at` TIMESTAMP
- `appointment_id` UUID → appointments
- `description` TEXT - описание запчасти

**Добавлены индексы:**
- По номеру заявки
- По назначенному сотруднику
- По заявке в appointment_parts

**Добавлен статус:**
- Новый статус `archived` для архивных заявок

**Создан триггер:**
- Автоматическое архивирование когда `completed` + `parts_paid` + `work_paid`

### 2. ✅ Скрипт генерации импорта
**Файл:** `scripts/generate-import-sql.mjs`

Автоматически генерирует SQL из JSON бэкапа.

### 3. ✅ Сгенерирован SQL импорта
**Файл:** `database/migrations/generated_import.sql` (2701 строк)

Готов к выполнению после небольших правок.

### 4. ✅ Инструкции
**Файл:** `database/migrations/IMPORT_INSTRUCTIONS.md`

Подробное руководство по импорту.

## 📝 Чек-лист для выполнения импорта

### Подготовка (перед импортом)

- [ ] **Шаг 1:** Убедитесь что все клиенты импортированы
  ```sql
  -- Проверить наличие клиентов
  SELECT COUNT(*) FROM customers;
  
  -- Найти каких клиентов не хватает
  SELECT DISTINCT clientPhone, clientName 
  FROM (VALUES 
    ('380509298505', 'Юра'),
    ('380672545958', 'Саша шкода')
    -- ... остальные из бэкапа
  ) AS backup(phone, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM customers WHERE customers.phone = backup.phone
  );
  ```

- [ ] **Шаг 2:** Убедитесь что все автомобили импортированы
  ```sql
  -- Проверить наличие автомобилей
  SELECT COUNT(*) FROM vehicles;
  
  -- Найти каких автомобилей не хватает по VIN
  ```

- [ ] **Шаг 3:** Узнайте ваш UUID пользователя СТО
  ```sql
  -- Найти ваш UUID
  SELECT id, email FROM auth.users WHERE email = 'ваш@email.com';
  ```

### Выполнение импорта

- [ ] **Шаг 4:** Применить миграцию структуры БД
  - Открыть Supabase Dashboard → SQL Editor
  - Вставить содержимое `add_appointment_payment_fields.sql`
  - Выполнить

- [ ] **Шаг 5:** Отредактировать `generated_import.sql`
  - Заменить все `NULL, -- created_by` на ваш UUID
  - Или выполнить замену регуляркой:
    ```
    Найти: NULL, -- created_by \(заполнить вручную\)
    Заменить: 'ВАШ-UUID-ЗДЕСЬ'
    ```

- [ ] **Шаг 6:** Выполнить импорт
  - Открыть Supabase Dashboard → SQL Editor
  - Вставить содержимое `generated_import.sql` (2701 строка)
  - Выполнить
  - Проверить что нет ошибок

### Проверка результата

- [ ] **Шаг 7:** Проверить количество импортированных заявок
  ```sql
  SELECT COUNT(*) FROM appointments;
  -- Должно быть 53
  ```

- [ ] **Шаг 8:** Проверить распределение по статусам
  ```sql
  SELECT status, COUNT(*) 
  FROM appointments 
  GROUP BY status
  ORDER BY status;
  
  -- Ожидается:
  -- in_progress: несколько
  -- scheduled: несколько
  -- completed: несколько
  -- archived: большинство
  ```

- [ ] **Шаг 9:** Проверить оплаты
  ```sql
  SELECT 
    COUNT(*) FILTER (WHERE parts_paid = TRUE) as оплачены_запчасти,
    COUNT(*) FILTER (WHERE work_paid = TRUE) as оплачена_работа,
    COUNT(*) FILTER (WHERE parts_paid = TRUE AND work_paid = TRUE) as оплачено_все
  FROM appointments;
  ```

- [ ] **Шаг 10:** Проверить запчасти
  ```sql
  SELECT COUNT(*) FROM appointment_parts;
  -- Должно быть много записей
  
  -- Проверить связи
  SELECT 
    a.request_number,
    COUNT(ap.id) as количество_запчастей
  FROM appointments a
  LEFT JOIN appointment_parts ap ON a.id = ap.appointment_id
  GROUP BY a.request_number
  HAVING COUNT(ap.id) > 0
  ORDER BY COUNT(ap.id) DESC
  LIMIT 10;
  ```

- [ ] **Шаг 11:** Проверить триггер архивирования
  ```sql
  -- Найти завершенную заявку без полной оплаты
  SELECT * FROM appointments 
  WHERE status = 'completed' 
    AND (parts_paid = FALSE OR work_paid = FALSE)
  LIMIT 1;
  
  -- Пометить как полностью оплаченную
  UPDATE appointments 
  SET parts_paid = TRUE, work_paid = TRUE
  WHERE id = 'ID_ЗАЯВКИ';
  
  -- Проверить что статус стал 'archived'
  SELECT status FROM appointments WHERE id = 'ID_ЗАЯВКИ';
  ```

### После импорта

- [ ] **Шаг 12:** Распределить заявки между сотрудниками
  ```sql
  -- Посмотреть сколько заявок без назначения
  SELECT COUNT(*) FROM appointments WHERE assigned_to IS NULL;
  
  -- Назначить все заявки "в работе" одному сотруднику
  UPDATE appointments 
  SET 
    assigned_to = 'UUID_СОТРУДНИКА',
    assigned_to_name = 'Имя Сотрудника'
  WHERE status IN ('scheduled', 'in_progress')
    AND assigned_to IS NULL;
  ```

- [ ] **Шаг 13:** Проверить UI приложения
  - Открыть страницу Appointments
  - Проверить что заявки отображаются
  - Проверить фильтры по статусам
  - Проверить галочки оплаты

- [ ] **Шаг 14:** Протестировать создание новой заявки
  - Создать тестовую заявку
  - Проверить что генерируется request_number
  - Добавить запчасти
  - Проверить переход в архив при оплате

## 🚨 Известные проблемы

### Пропущенные заявки (8 штук)
Эти заявки из другого СТО (`stoId: "HfTWxiVrhzmKbtbbBgcq"`), у них другая структура:
- GvNu0ObX1IpZgym4usOV
- QJxRKugcZdpsXFQCRhun
- SUrP6gJG3bdZoCtN48WC
- V0PJdHqmKWCrM9pgNwtQ
- ZjynjATQaCkhaVfoLo6q
- cXumNt1eGjv2nMI02NLC
- flwvefZTcJ2Gq4r9pVLy
- zfksADGL5K83mMh23qzM

**Решение:** Если нужны - импортировать вручную после проверки данных клиентов.

## 🎨 Следующие задачи (UI)

1. **Добавить в AdminPanel кнопку "Массово назначить заявки"**
   - Выбрать сотрудника из списка
   - Выбрать какие заявки назначать (все незавершенные, или по фильтру)
   - Кнопка "Назначить"

2. **Обновить страницу Appointments**
   - Добавить колонку "Номер заявки"
   - Показывать галочки оплаты
   - Фильтр по статусу включая "Архив"
   - Кнопка "Готова к выдаче"

3. **Обновить форму редактирования заявки**
   - Поля для галочек оплаты
   - Показ assigned_to
   - Список запчастей из appointment_parts

## 📞 Поддержка

Если возникли проблемы - проверьте:
1. Логи Supabase (Dashboard → Logs)
2. Вывод SQL запросов выше
3. Файл IMPORT_INSTRUCTIONS.md

---

**Готов начать импорт? Согласуйте каждый шаг!**
