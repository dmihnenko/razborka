# 📋 Пошаговая инструкция по импорту данных из Firebase

## ✅ Что готово:
- 23 клиента для импорта
- 38 автомобилей для импорта
- 53 заявки для импорта
- Все SQL скрипты сгенерированы

## 🔢 Порядок выполнения (СТРОГО ПО НОМЕРАМ!)

### Шаг 1: Добавить UNIQUE constraints
📄 **Файл:** `database/migrations/add_unique_constraints.sql`

**Действие:** Скопировать содержимое файла и выполнить в Supabase SQL Editor

**Что делает:**
- Добавляет UNIQUE constraint на `customers.phone`
- Добавляет UNIQUE constraint на `vehicles.vin`
- Обрабатывает возможные дубликаты

---

### Шаг 2: Импортировать клиентов и автомобили
📄 **Файл:** `database/migrations/import_clients_vehicles.sql` (1130 строк)

**Действие:** Скопировать содержимое файла и выполнить в Supabase SQL Editor

**Что делает:**
- Импортирует 23 клиента
- Импортирует 38 автомобилей
- Использует ON CONFLICT для обновления существующих

**Результат:**
```sql
-- Проверить импорт клиентов
SELECT COUNT(*) FROM customers;

-- Проверить импорт автомобилей  
SELECT COUNT(*) FROM vehicles;
```

---

### Шаг 3: Узнать ваш UUID пользователя
**Действие:** Выполнить в Supabase SQL Editor:

```sql
SELECT id, email, raw_user_meta_data->>'full_name' as name 
FROM auth.users 
WHERE email = 'ВАШ_EMAIL@example.com';
```

**Скопировать UUID** (например: `12345678-1234-1234-1234-123456789abc`)

---

### Шаг 4: Заменить UUID в generated_import.sql

⚠️ **ВАЖНО:** Перед выполнением импорта заявок!

**Вариант А - Через VS Code:**
1. Открыть `database/migrations/generated_import.sql`
2. Ctrl+H (Find & Replace)
3. Найти: `NULL, -- created_by (заполнить вручную)`
4. Заменить на: `'ВАШ_UUID_ЗДЕСЬ'`
5. Replace All (должно быть ~53 замены)
6. Сохранить файл

**Вариант Б - Создам скрипт автозамены:**
Скажите ваш UUID - я создам обновленный файл.

---

### Шаг 5: Импортировать заявки
📄 **Файл:** `database/migrations/generated_import.sql` (2701 строка, ПОСЛЕ замены UUID!)

**Действие:** Скопировать содержимое файла и выполнить в Supabase SQL Editor

**Что делает:**
- Импортирует 53 заявки
- Импортирует запчасти к заявкам
- Связывает с клиентами и автомобилями

**Результат:**
```sql
-- Проверить импорт заявок
SELECT COUNT(*) FROM appointments;
-- Должно быть 53

-- Проверить статусы
SELECT status, COUNT(*) 
FROM appointments 
GROUP BY status;

-- Проверить запчасти
SELECT COUNT(*) FROM appointment_parts;
```

---

## ✅ Проверка после импорта

### Шаг 6: Финальная проверка данных

```sql
-- 1. Количество записей
SELECT 
  'Клиенты' as таблица, COUNT(*) as количество FROM customers
UNION ALL
SELECT 
  'Автомобили', COUNT(*) FROM vehicles
UNION ALL
SELECT 
  'Заявки', COUNT(*) FROM appointments
UNION ALL
SELECT 
  'Запчасти', COUNT(*) FROM appointment_parts;

-- 2. Статусы заявок
SELECT status, COUNT(*) as количество
FROM appointments 
GROUP BY status
ORDER BY status;

-- 3. Заявки с оплатами
SELECT 
  COUNT(*) FILTER (WHERE parts_paid = TRUE) as запчасти_оплачены,
  COUNT(*) FILTER (WHERE work_paid = TRUE) as работы_оплачены,
  COUNT(*) FILTER (WHERE parts_paid = TRUE AND work_paid = TRUE) as всё_оплачено
FROM appointments;

-- 4. Топ клиентов по количеству заявок
SELECT 
  c.name,
  c.phone,
  COUNT(a.id) as количество_заявок
FROM customers c
LEFT JOIN appointments a ON a.customer_id = c.id
GROUP BY c.id, c.name, c.phone
HAVING COUNT(a.id) > 0
ORDER BY COUNT(a.id) DESC
LIMIT 10;

-- 5. Заявки с запчастями
SELECT 
  a.request_number,
  c.name as клиент,
  COUNT(ap.id) as количество_запчастей
FROM appointments a
LEFT JOIN customers c ON c.id = a.customer_id
LEFT JOIN appointment_parts ap ON ap.appointment_id = a.id
GROUP BY a.id, a.request_number, c.name
HAVING COUNT(ap.id) > 0
ORDER BY COUNT(ap.id) DESC
LIMIT 10;
```

---

## 🚨 Что делать если ошибка

### Ошибка: "duplicate key value violates unique constraint"
**Решение:** Данные уже импортированы. Проверьте через SELECT COUNT(*).

### Ошибка: "null value in column customer_id violates not-null constraint"
**Решение:** 
1. Проверить что клиент существует:
```sql
SELECT * FROM customers WHERE phone = 'ТЕЛЕФОН_ИЗ_ОШИБКИ';
```
2. Если нет - добавить вручную или пропустить эту заявку.

### Ошибка: "there is no unique or exclusion constraint matching the ON CONFLICT"
**Решение:** Не выполнен Шаг 1 (add_unique_constraints.sql). Вернитесь к Шагу 1.

---

## 📊 Ожидаемый результат

После всех шагов в базе должно быть:
- ✅ **23+ клиента** (может быть больше если были до импорта)
- ✅ **38+ автомобилей**
- ✅ **53 заявки**
- ✅ **Много запчастей** в appointment_parts
- ✅ Статусы: `in_progress`, `scheduled`, `completed`, `archived`
- ✅ Отмеченные оплаты (parts_paid, work_paid)

---

## 🎯 Готовы начать?

**Начинайте с Шага 1!** Выполняйте по порядку, согласовывая каждый шаг.

Сообщите когда:
- ✅ Выполнен Шаг 1
- ✅ Выполнен Шаг 2
- ✅ Получен UUID (Шаг 3)
- Тогда перейдем к Шагу 4 и 5!
