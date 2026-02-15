# Импорт работ и запчастей из Firebase

Были добавлены недостающие работы и детализированные запчасти из бекапа Firebase.

## Шаги для импорта

### 1. Расширить таблицу appointment_parts
Выполните в Supabase SQL Editor:
```sql
-- Файл: database/migrations/extend_appointment_parts.sql
```
Это добавит поля quantity, store_cost, client_cost в таблицу запчастей.

### 2. Создать таблицу appointment_services
Выполните в Supabase SQL Editor:
```sql
-- Файл: database/migrations/create_appointment_services.sql
```
Это создаст таблицу для хранения работ с описанием и стоимостью.

### 3. Импортировать данные
Выполните обновленный импорт:
```sql
-- Файл: database/migrations/generated_import.sql
```

## Что было импортировано

### Запчасти (appointment_parts)
- **Простые запчасти** (из поля `parts`): описание без цены
- **Детальные запчасти** (из поля `partsDetails`): название, количество, стоимость закупки, стоимость для клиента
- **Позиции лота** (из поля `lotItems`): аналогично детальным запчастям

### Работы (appointment_services)
- Извлечены из поля `description`
- Формат: "Описание работы СТОИМОСТЬ"
- Пример: "Установка дотяжки багажника 800" → description="Установка дотяжки багажника", cost=800

## Статистика
- Импортировано: 53 заявки
- Пропущено: 8 (без телефона или VIN)
- С работами: ~40 заявок
- С запчастями: ~35 заявок

## Проверка данных

После импорта проверьте:

```sql
-- Количество запчастей
SELECT COUNT(*) FROM appointment_parts;

-- Количество работ
SELECT COUNT(*) FROM appointment_services;

-- Заявки с работами и запчастями
SELECT 
  a.request_number,
  (SELECT COUNT(*) FROM appointment_parts WHERE appointment_id = a.id) as parts_count,
  (SELECT COUNT(*) FROM appointment_services WHERE appointment_id = a.id) as services_count
FROM appointments a
WHERE a.firebase_id IS NOT NULL
ORDER BY a.request_number;
```

## Обновление интерфейса

Нужно обновить страницу деталей заявки (AppointmentDetails.tsx), чтобы показывать:
- Детализированные запчасти с количеством и ценами
- Список работ со стоимостью
- Общую сумму работ
