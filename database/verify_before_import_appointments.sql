-- ========================================
-- ПРОВЕРКА ДАННЫХ ПЕРЕД ИМПОРТОМ ЗАЯВОК
-- ========================================
-- Сверяем структуру Firebase backup с Supabase схемой

-- ===========================================
-- 1. СТРУКТУРА ТАБЛИЦЫ APPOINTMENTS В SUPABASE
-- ===========================================

-- Проверяем текущую структуру таблицы appointments
select 
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_name = 'appointments'
order by ordinal_position;

-- Ожидаемая структура:
-- id                    | uuid                  | NO  | uuid_generate_v4()
-- created_at            | timestamp with tz     | NO  | now()
-- customer_id           | uuid                  | NO  | -
-- vehicle_id            | uuid                  | NO  | -
-- scheduled_date        | timestamp with tz     | NO  | -
-- status                | text                  | NO  | 'pending'
-- notes                 | text                  | YES | -
-- sto_company_id        | uuid                  | YES | -
-- work_items            | jsonb                 | YES | '[]'
-- part_items            | jsonb                 | YES | '[]'
-- total_work_cost       | numeric(10,2)         | YES | 0
-- total_parts_cost      | numeric(10,2)         | YES | 0
-- total_cost            | numeric(10,2)         | YES | 0
-- updated_at            | timestamp with tz     | YES | now()
-- assigned_to           | uuid                  | YES | -
-- created_by            | uuid                  | YES | -


-- ===========================================
-- 2. МАППИНГ ПОЛЕЙ FIREBASE → SUPABASE
-- ===========================================

-- Firebase backup поля:
-- id                    → НЕ используем (создаем новый UUID)
-- createdAt             → created_at (timestamp)
-- completedAt           → НЕТ в appointments (можно добавить)
-- clientId              → customer_id (через JOIN по phone)
-- vehicleId             → vehicle_id (через JOIN по VIN)
-- clientPhone           → используем для поиска customer_id
-- vehicleVin            → используем для поиска vehicle_id
-- status                → status (с маппингом)
-- description           → notes (или создать отдельное поле description)
-- parts                 → part_items (преобразуем из string[] в JSONB)
-- workPaid              → НЕТ прямого соответствия (добавить?)
-- partsPaid             → НЕТ прямого соответствия (добавить?)
-- requestNumber         → НЕТ в appointments (можно добавить)
-- stoId                 → sto_company_id (наш UUID СТО)
-- createdBy             → created_by (наш manager UUID)
-- vehicleMake           → не нужно (есть в vehicles)
-- vehicleYear           → не нужно (есть в vehicles)
-- clientName            → не нужно (есть в customers)


-- ===========================================
-- 3. ПРОВЕРКА НЕДОСТАЮЩИХ ПОЛЕЙ
-- ===========================================

-- Firebase имеет поля, которых НЕТ в Supabase appointments:
-- 1. completedAt - дата завершения заявки
-- 2. description - описание работ (сейчас используем notes)
-- 3. workPaid - оплачены ли работы (boolean)
-- 4. partsPaid - оплачены ли запчасти (boolean)
-- 5. requestNumber - номер заказ-наряда (например "STO-245404-163")

-- РЕШЕНИЕ: Добавим недостающие поля в таблицу appointments

alter table appointments add column if not exists completed_at timestamp with time zone;
alter table appointments add column if not exists description text;
alter table appointments add column if not exists work_paid boolean default false;
alter table appointments add column if not exists parts_paid boolean default false;
alter table appointments add column if not exists request_number text;

comment on column appointments.completed_at is 'Дата фактического завершения заявки';
comment on column appointments.description is 'Описание работ и услуг';
comment on column appointments.work_paid is 'Оплачены ли работы';
comment on column appointments.parts_paid is 'Оплачены ли запчасти';
comment on column appointments.request_number is 'Номер заказ-наряда (например STO-245404-163)';


-- ===========================================
-- 4. МАППИНГ СТАТУСОВ
-- ===========================================

-- Firebase статусы → Supabase статусы:
-- "Архив"            → 'completed'
-- "В работе"         → 'in_progress'
-- "Активна"          → 'confirmed'
-- "Выполнена"        → 'completed'
-- "Готово"           → 'completed'
-- "Запчасти оплачены" → 'confirmed' (или 'pending' с parts_paid=true)

-- Проверяем уникальные статусы в базе:
select distinct status from appointments;

-- Допустимые статусы в Supabase:
-- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'paid'


-- ===========================================
-- 5. ФОРМАТ СПИСКА ЗАПЧАСТЕЙ
-- ===========================================

-- Firebase parts - массив строк:
-- ["4 штекера на 2 пина 250 грн", "Яндекс станция акс 8500"]

-- Supabase part_items - JSONB массив объектов:
-- [
--   {
--     "id": "uuid",
--     "name": "4 штекера на 2 пина 250 грн",
--     "quantity": 1,
--     "price": 0,
--     "totalPrice": 0,
--     "isPaid": false
--   }
-- ]

-- Функция для преобразования уже создана в import_step4_appointments.sql:
-- parse_parts_array(text[]) → jsonb


-- ===========================================
-- 6. ПРОВЕРКА НАЛИЧИЯ КЛИЕНТОВ И АВТОМОБИЛЕЙ
-- ===========================================

-- Проверяем, что все клиенты из Firebase уже импортированы
-- (по телефонам из backup)

with firebase_phones as (
  select distinct unnest(ARRAY[
    '380509298505',  -- Юра
    '380931234567',  -- Орест
    '380951234567',  -- Дима
    '380991234567',  -- Станислав
    '380681234567',  -- Оксана
    '380971234567',  -- Дима i30
    '380509298505',  -- Валидол (дубликат)
    '380672545958',  -- Саша шкода
    '380672949293',  -- Владимир
    '380503507444',  -- Максим
    '380931537277',  -- Александр
    '380505554353',  -- Женя
    '380675550099',  -- Виталий
    '380936622772',  -- Александр 2
    '380679087077'   -- Сергей
  ]) as phone
)
select 
  fp.phone,
  case when c.id is not null then '✅ Найден' else '❌ НЕ НАЙДЕН' end as status,
  c.name
from firebase_phones fp
left join customers c on c.phone = fp.phone
order by status, fp.phone;

-- Проверяем, что все автомобили из Firebase уже импортированы
-- (по VIN из backup)

with firebase_vins as (
  select distinct unnest(ARRAY[
    '4T1KZ1AK8PU085334',    -- Toyota camry
    'WVGZZZ7LZBD028956',    -- Touareg
    'XTAKS015LK0619473',    -- Vesta
    'JM1BL1SF7A1234567',    -- Mazda 3
    '5YJ3E1EA4MF123451',    -- Tesla 1
    'KNADC163696123456',    -- RIO
    'KMHD341CAKU123456',    -- i30
    'JT2BF18K5X0123456',    -- Camry 2012 (Валидол 1)
    'TMBCK7NE8F0196671',    -- Шкода
    'WVWZZZ1KZ9W123456'     -- Passat B8
  ]) as vin
)
select 
  fv.vin,
  case when v.id is not null then '✅ Найден' else '❌ НЕ НАЙДЕН' end as status,
  v.brand || ' ' || v.model as vehicle,
  c.name as owner
from firebase_vins fv
left join vehicles v on v.vin = fv.vin
left join customers c on c.id = v.customer_id
order by status, fv.vin;


-- ===========================================
-- 7. АНАЛИЗ СТРУКТУРЫ PARTS В FIREBASE
-- ===========================================

-- Примеры parts из backup:
-- 1. Пустой массив: "parts": []
-- 2. С данными: "parts": ["4 штекера на 2 пина 250 грн"]
-- 3. С данными: "parts": ["Яндекс станция акс 8500"]
-- 4. Множественные: "parts": ["Магнита под телефон 250", "Наложка на перед руля 500", "Антишрав пленка 600"]

-- Формат строки parts обычно: "<название> <цена> [грн]"
-- Парсинг цены из строки - сложная задача, пока используем price=0


-- ===========================================
-- 8. ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
-- ===========================================

-- Сколько всего клиентов в базе для нашего СТО?
select count(*) as total_customers
from customers
where sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';

-- Сколько всего автомобилей в базе для нашего СТО?
select count(*) as total_vehicles
from vehicles
where sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';

-- Сколько автомобилей без клиента (orphaned)?
select count(*) as orphaned_vehicles
from vehicles v
where v.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
  and not exists (
    select 1 from customers c where c.id = v.customer_id
  );


-- ===========================================
-- 9. ФИНАЛЬНЫЙ ЧЕКЛИСТ ПЕРЕД ИМПОРТОМ
-- ===========================================

-- ✅ Проверить структуру таблицы appointments
-- ✅ Добавить недостающие поля (completed_at, description, work_paid, parts_paid, request_number)
-- ✅ Проверить маппинг статусов Firebase → Supabase
-- ✅ Создать функцию parse_parts_array() для преобразования parts
-- ✅ Проверить наличие всех клиентов в базе (по phone)
-- ✅ Проверить наличие всех автомобилей в базе (по VIN)
-- ✅ Убедиться что manager mng существует (a345e667-6a2d-4c49-a321-a39738e76b2d)
-- ✅ Убедиться что СТО существует (e0e2202a-e4c2-4505-8b4c-07037cb64281)

-- Проверяем менеджера mng
select 
  id,
  email,
  full_name,
  sto_company_id
from user_profiles
where id = 'a345e667-6a2d-4c49-a321-a39738e76b2d';

-- Проверяем СТО
select 
  id,
  name,
  created_at
from sto_companies
where id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';


-- ===========================================
-- 10. РЕКОМЕНДАЦИИ
-- ===========================================

-- 1. Добавить поля completed_at, description, work_paid, parts_paid, request_number
-- 2. Использовать description для Firebase.description вместо notes
-- 3. Использовать notes для внутренних комментариев СТО
-- 4. Сохранять оригинальные даты createdAt и completedAt из Firebase
-- 5. Все заявки назначать менеджеру mng (assigned_to и created_by)
-- 6. Парсить parts как простые объекты с quantity=1, price=0
-- 7. После импорта можно вручную обновить цены на запчасти
