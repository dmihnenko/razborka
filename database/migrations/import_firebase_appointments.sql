-- Скрипт импорта заявок из Firebase бэкапа
-- Этот скрипт должен выполняться ПОСЛЕ применения add_appointment_payment_fields.sql

-- ВАЖНО: Перед импортом заполните переменные:
-- 1. Ваш STO ID (user_id владельца СТО)
-- 2. Данные клиентов и автомобилей из бэкапа

-- Пример импорта одной заявки (шаблон):
-- INSERT INTO appointments (
--   firebase_id,
--   request_number,
--   customer_id,
--   vehicle_id,
--   scheduled_date,
--   scheduled_time,
--   status,
--   description,
--   parts_paid,
--   work_paid,
--   parts_cost,
--   parts_client_cost,
--   created_at,
--   completed_at,
--   assigned_to_name,
--   ready_for_pickup,
--   created_by,
--   notes
-- ) VALUES (
--   '2jqpDlUr7hwufvwWmeWo', -- firebase_id
--   'STO-245404-163', -- request_number
--   (SELECT id FROM customers WHERE phone = '380509298505' LIMIT 1), -- customer_id
--   (SELECT id FROM vehicles WHERE vin = '4T1KZ1AK8PU085334' LIMIT 1), -- vehicle_id
--   '2025-10-14 08:07:25'::TIMESTAMP, -- scheduled_date
--   NULL, -- scheduled_time
--   'archived', -- status (было "Архив")
--   'Установка дотяжки багажника 800\nПодключение и распиновка лам поворота и ходовых огней 600', -- description
--   TRUE, -- parts_paid
--   TRUE, -- work_paid
--   NULL, -- parts_cost
--   NULL, -- parts_client_cost
--   '2025-10-14 08:07:25'::TIMESTAMP, -- created_at
--   '2025-11-13 12:26:42'::TIMESTAMP, -- completed_at
--   NULL, -- assigned_to_name
--   FALSE, -- ready_for_pickup
--   NULL, -- created_by (заполним вашим ID)
--   NULL -- notes
-- );

-- Пример добавления запчастей к заявке:
-- INSERT INTO appointment_parts (appointment_id, description)
-- SELECT 
--   id,
--   '4 штекера на 2 пина 250 грн'
-- FROM appointments WHERE firebase_id = '2jqpDlUr7hwufvwWmeWo';

-- ============================================================
-- ИНСТРУКЦИЯ ПО ИМПОРТУ:
-- ============================================================
-- 1. Сначала примените миграцию add_appointment_payment_fields.sql
-- 2. Убедитесь что все клиенты и автомобили импортированы
-- 3. Замените '00000000-0000-0000-0000-000000000000' на ваш реальный user_id
-- 4. Используйте отдельный скрипт для генерации INSERT statements из JSON
-- ============================================================

-- Функция для генерации номера заявки
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT AS $$
DECLARE
  random_part TEXT;
  timestamp_part TEXT;
BEGIN
  -- Генерируем случайные числа
  random_part := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  timestamp_part := LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
  
  RETURN 'STO-' || random_part || '-' || timestamp_part;
END;
$$ LANGUAGE plpgsql;

-- Проверка уникальности номера заявки перед импортом
CREATE OR REPLACE FUNCTION check_request_number_unique(req_num TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (SELECT 1 FROM appointments WHERE request_number = req_num);
END;
$$ LANGUAGE plpgsql;
