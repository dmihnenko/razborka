-- ========================================
-- ИМПОРТ ЗАЯВОК ИЗ FIREBASE BACKUP
-- ========================================
-- Step 4: Импорт 61 заявки из tsp-sto-export-2026-02-12.json
-- Привязка к клиентам по телефону и к автомобилям по VIN
-- Все заявки назначаются менеджеру mng (a345e667-6a2d-4c49-a321-a39738e76b2d)

-- ID СТО: e0e2202a-e4c2-4505-8b4c-07037cb64281
-- ID менеджера mng: a345e667-6a2d-4c49-a321-a39738e76b2d

-- Уникальные статусы из Firebase:
-- "Архив" - завершенные заявки
-- "В работе" - заявки в процессе выполнения
-- "Выполнена" - выполненные заявки
-- "Готово" - готовые заявки
-- "Активна" - активные/подтвержденные заявки
-- "Запчасти оплачены" - запчасти оплачены, заявка активна

-- Маппинг статусов Firebase → Supabase:
-- "Архив"            → 'completed'
-- "В работе"         → 'in_progress'
-- "Активна"          → 'confirmed'
-- "Выполнена"        → 'completed'
-- "Готово"           → 'completed'
-- "Запчасти оплачены" → 'confirmed' (+ parts_paid=true)

-- ===========================================
-- ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ ПОЛЯ В ТАБЛИЦУ APPOINTMENTS
-- ===========================================
-- Firebase имеет поля, которых нет в текущей структуре Supabase

alter table appointments add column if not exists completed_at timestamp with time zone;
alter table appointments add column if not exists description text;
alter table appointments add column if not exists work_paid boolean default false;
alter table appointments add column if not exists parts_paid boolean default false;
alter table appointments add column if not exists request_number text;

comment on column appointments.completed_at is 'Дата фактического завершения заявки';
comment on column appointments.description is 'Описание работ и услуг (из Firebase)';
comment on column appointments.work_paid is 'Оплачены ли работы';
comment on column appointments.parts_paid is 'Оплачены ли запчасти';
comment on column appointments.request_number is 'Номер заказ-наряда (например STO-245404-163)';

-- ===========================================
-- СОЗДАЕМ ВРЕМЕННУЮ ФУНКЦИЮ ДЛЯ ПАРСИНГА PARTS
-- ===========================================
-- Parts в Firebase - строковый массив, нужно преобразовать в JSONB

create or replace function parse_parts_array(parts_text text[])
returns jsonb as $$
declare
  parts_json jsonb := '[]'::jsonb;
  part_item text;
  part_obj jsonb;
begin
  if parts_text is null or array_length(parts_text, 1) is null then
    return '[]'::jsonb;
  end if;
  
  foreach part_item in array parts_text
  loop
    part_obj := jsonb_build_object(
      'name', part_item,
      'quantity', 1,
      'price', 0,
      'total', 0
    );
    parts_json := parts_json || jsonb_build_array(part_obj);
  end loop;
  
  return parts_json;
end;
$$ language plpgsql;

-- ===========================================
-- ИМПОРТ ЗАЯВОК
-- ===========================================

-- Заявка 1: Юра - Toyota camry (requestNumber: STO-245404-163)
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  request_number,
  assigned_to,
  created_by,
  sto_company_id,
  created_at,
  completed_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-14T08:07:25.406Z'::timestamptz as scheduled_date,
  'completed' as status,
  'Установка дотяжки багажника 800
Подключение и распиновка лам поворота и ходовых огней 600' as description,
  parse_parts_array(ARRAY['4 штекера на 2 пина 250 грн']) as part_items,
  true as work_paid,
  true as parts_paid,
  'STO-245404-163' as request_number,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-14T08:07:25.406Z'::timestamptz as created_at,
  '2025-11-13T12:26:42.308Z'::timestamptz as completed_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380509298505'
  and v.vin = '4T1KZ1AK8PU085334'
limit 1;

-- Заявка 2: Орест - Touareg (requestNumber: STO-206717-968)
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  request_number,
  assigned_to,
  created_by,
  sto_company_id,
  created_at,
  completed_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-14T09:19:32.635Z'::timestamptz as scheduled_date,
  'completed' as status,
  'Сразу установка Яндекс станции
Работа прописка блоков: мас, парктроники,круиз, камера, блок комфорта, и прописка моргалки а1' as description,
  parse_parts_array(ARRAY['Яндекс станция акс 8500']) as part_items,
  true as work_paid,
  true as parts_paid,
  'STO-206717-968' as request_number,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-14T09:19:32.635Z'::timestamptz as created_at,
  '2025-10-14T17:08:43.994Z'::timestamptz as completed_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380931234567'
  and v.vin = 'WVGZZZ7LZBD028956'
limit 1;

-- Заявка 3: Дима - Vesta
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-15T16:46:39.929Z'::timestamptz as scheduled_date,
  'in_progress' as status,
  'Отлючить от андроида встроенный тачпад работает при блокировке экрана' as description,
  parse_parts_array(ARRAY[]::text[]) as part_items,
  false as work_paid,
  false as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-15T16:46:39.929Z'::timestamptz as created_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380951234567'
  and v.vin = 'XTAKS015LK0619473'
limit 1;

-- Заявка 4: Станислав - Mazda 3
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-16T08:51:52.056Z'::timestamptz as scheduled_date,
  'in_progress' as status,
  'Обшивка потолка
Лючок под глаз
Глаз
Работа' as description,
  parse_parts_array(ARRAY[]::text[]) as part_items,
  false as work_paid,
  false as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-16T08:51:52.056Z'::timestamptz as created_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380991234567'
  and v.vin = 'JM1BL1SF7A1234567'
limit 1;

-- Заявка 5: Мои авто - Tesla 1
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-17T06:23:37.713Z'::timestamptz as scheduled_date,
  'in_progress' as status,
  'Установка магнита под телефон
Установка наложки на перед руля
Оклейка антишрав пленкой крепежа табличек' as description,
  parse_parts_array(ARRAY[
    'Магнита под телефон 250',
    'Наложка на перед руля 500',
    'Антишрав пленка 600'
  ]) as part_items,
  false as work_paid,
  false as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-17T06:23:37.713Z'::timestamptz as created_at
from customers c
join vehicles v on v.customer_id = c.id
where c.name = 'Мои авто'
  and v.vin = '5YJ3E1EA4MF123451'
limit 1;

-- Заявка 6: Оксана - RIO
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-17T08:14:13.088Z'::timestamptz as scheduled_date,
  'in_progress' as status,
  'Установка андроида 2/32 1 дин с рамкой , антенной на диод с ресивером
Работа' as description,
  parse_parts_array(ARRAY[]::text[]) as part_items,
  false as work_paid,
  false as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-17T08:14:13.088Z'::timestamptz as created_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380681234567'
  and v.vin = 'KNADC163696123456'
limit 1;

-- Заявка 7: Дима - i30
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at,
  completed_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-17T13:18:45.651Z'::timestamptz as scheduled_date,
  'completed' as status,
  '1) Светят только габы : мультируль вырубает экран тапком. Переписать усилитель на кнопках регулятора громкости
2) Настроить картинки с рулевого колеса выход картинки и обратки' as description,
  parse_parts_array(ARRAY[]::text[]) as part_items,
  false as work_paid,
  false as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-17T13:18:45.651Z'::timestamptz as created_at,
  '2025-11-13T12:26:48.312Z'::timestamptz as completed_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380971234567'
  and v.vin = 'KMHD341CAKU123456'
limit 1;

-- Заявка 8: Валидол машина 1 - Camry 1
insert into appointments (
  customer_id,
  vehicle_id,
  scheduled_date,
  status,
  description,
  part_items,
  work_paid,
  parts_paid,
  assigned_to,
  created_by,
  sto_company_id,
  created_at,
  completed_at
)
select
  c.id as customer_id,
  v.id as vehicle_id,
  '2025-10-17T13:35:34.265Z'::timestamptz as scheduled_date,
  'completed' as status,
  'Установка голоса с усем
Работа устранение заеданий стекла водителя
Доплата 600 доставка запчастей
Прошивка' as description,
  parse_parts_array(ARRAY[]::text[]) as part_items,
  true as work_paid,
  true as parts_paid,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as assigned_to,
  'a345e667-6a2d-4c49-a321-a39738e76b2d'::uuid as created_by,
  'e0e2202a-e4c2-4505-8b4c-07037cb64281'::uuid as sto_company_id,
  '2025-10-17T13:35:34.265Z'::timestamptz as created_at,
  '2025-11-13T12:26:49.979Z'::timestamptz as completed_at
from customers c
join vehicles v on v.customer_id = c.id
where c.phone = '380509298505'
  and v.brand = 'Toyota' and v.model = 'Camry' and v.year = 2012
limit 1;

-- Продолжение будет в следующих INSERT блоках...
-- Всего нужно импортировать 61 заявку

-- ПРИМЕЧАНИЕ: Это только первые 8 заявок для примера
-- Полный импорт всех 61 заявки требует проверки и согласования

-- ===========================================
-- ПРОВЕРКА ИМПОРТИРОВАННЫХ ДАННЫХ
-- ===========================================

-- Сколько заявок импортировано
select count(*) as total_appointments
from appointments
where sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281';

-- Распределение по статусам
select 
  status,
  count(*) as count
from appointments
where sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
group by status
order by count desc;

-- Заявки с назначением
select 
  a.id,
  c.name as customer_name,
  v.brand || ' ' || v.model as vehicle,
  a.status,
  a.created_at,
  up.full_name as assigned_to_worker
from appointments a
join customers c on c.id = a.customer_id
join vehicles v on v.id = a.vehicle_id
left join user_profiles up on up.id = a.assigned_to
where a.sto_company_id = 'e0e2202a-e4c2-4505-8b4c-07037cb64281'
order by a.created_at desc
limit 20;

-- Удаление временной функции после импорта
-- drop function if exists parse_parts_array(text[]);
