-- Автоматически сгенерированный импорт из Firebase
-- Дата генерации: 2026-02-13T21:44:58.024Z
-- Всего заявок: 61

-- ВАЖНО: Перед выполнением замените YOUR_STO_USER_ID на ваш реальный UUID

-- Создаем уникальные индексы для защиты от дубликатов
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_parts_unique 
  ON appointment_parts(appointment_id, description);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_services_unique 
  ON appointment_services(appointment_id, description);

-- Устанавливаем кодировку UTF-8
SET client_encoding = 'UTF8';

-- Устанавливаем STO company_id
DO $$
DECLARE
  v_sto_company_id UUID := 'e0e2202a-e4c2-4505-8b4c-07037cb64281';
BEGIN
  -- Ничего не делаем, просто объявляем переменную для использования ниже
END $$;

BEGIN;


-- Заявка: STO-245404-163 (Юра)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '2jqpDlUr7hwufvwWmeWo',
  'STO-245404-163',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380509298505' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '4T1KZ1AK8PU085334' LIMIT 1),
  '2025-10-14T08:07:25.406Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Установка дотяжки багажника 800
Подключение и распиновка лам поворота и ходовых огней 600',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-10-14T08:07:25.406Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-13T12:26:42.308Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-245404-163
INSERT INTO appointment_parts (appointment_id, description)
SELECT id, '4 штекера на 2 пина 250 грн'
FROM appointments WHERE firebase_id = '2jqpDlUr7hwufvwWmeWo'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-245404-163
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка дотяжки багажника', 800
FROM appointments WHERE firebase_id = '2jqpDlUr7hwufvwWmeWo'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Подключение и распиновка лам поворота и ходовых огней', 600
FROM appointments WHERE firebase_id = '2jqpDlUr7hwufvwWmeWo'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-206717-968 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '3gI8gVoHpR02Leq5vkg3',
  'STO-206717-968',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-11-08T17:50:06.717Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена клапанной крышки 1200',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-08T17:50:06.717Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-08T17:50:39.415Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-206717-968
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена клапанной крышки', 1200
FROM appointments WHERE firebase_id = '3gI8gVoHpR02Leq5vkg3'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-991986-935 (Влад кум)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '3p34nhOs8qJFMWbGnZyi',
  'STO-991986-935',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380679710006' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WBAFB710X0LX77387' LIMIT 1),
  '2026-01-06T00:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '10:00',
  'in_progress',
  'Замена шаровых
Замена тяги рулевой
Замена передних колодок
Замена косточек передеих',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-05T14:23:11.986Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-991986-935
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Колодки', 1912, 1
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Шаровые', 1750, 1
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Косточки', 1811, 1
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Тяга рулевая', 935, 1
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Лампочки', 424, 1
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-991986-935
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена шаровых', NULL
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена тяги рулевой', NULL
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передних колодок', NULL
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена косточек передеих', NULL
FROM appointments WHERE firebase_id = '3p34nhOs8qJFMWbGnZyi'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-815926-264 (Влад кум)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '4sQm0mzMqjplbkfXWteW',
  'STO-815926-264',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380679710006' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'VSKJVWR51U0003144' LIMIT 1),
  '2026-01-30T00:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '09:00',
  'in_progress',
  'ТО с заменой топливного фильтра 1100',
  FALSE,
  FALSE,
  4456,
  4659,
  '2026-01-29T11:06:55.926Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Детальные запчасти для заявки STO-815926-264
INSERT INTO appointment_parts (appointment_id, description, quantity, store_cost, client_cost)
SELECT id, 'Запчасти для ТО', 1, 4456, 4659
FROM appointments WHERE firebase_id = '4sQm0mzMqjplbkfXWteW'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-815926-264
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'ТО с заменой топливного фильтра', 1100
FROM appointments WHERE firebase_id = '4sQm0mzMqjplbkfXWteW'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-764917-989 (Кирил менеджер )
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '5j8asbI0Rw1Duq6HkdTT',
  'STO-764917-989',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5N1AT3BA6MC810252' LIMIT 1),
  '2025-12-09T00:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '12:45',
  'in_progress',
  'Снятие установка глушителя 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-12-09T11:46:04.917Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  TRUE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-764917-989
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка глушителя', 500
FROM appointments WHERE firebase_id = '5j8asbI0Rw1Duq6HkdTT'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-256903-096 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '7VZAJ4BQEA97ancmUV4G',
  'STO-256903-096',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWSA7A3XNC000341' LIMIT 1),
  '2025-11-27T10:27:36.903Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена передней левой стойки с поворотным кулаком 800
Замена задних колодок 600',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-27T10:27:36.903Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-256903-096
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Колодки задние', 1640, 1
FROM appointments WHERE firebase_id = '7VZAJ4BQEA97ancmUV4G'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-256903-096
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передней левой стойки с поворотным кулаком', 800
FROM appointments WHERE firebase_id = '7VZAJ4BQEA97ancmUV4G'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задних колодок', 600
FROM appointments WHERE firebase_id = '7VZAJ4BQEA97ancmUV4G'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-570089-035 (Антон)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '9FgglbCD2Ou2DzSMhtIU',
  'STO-570089-035',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380671666969' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'JMZBK12Z551166370' LIMIT 1),
  '2025-10-28T10:32:50.089Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена подушки двигателя 400
Замена шкива генератора 500
Замена колодок ручника 600
Замена задней ступицы 500',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-10-28T10:32:50.089Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-03T02:32:57.786Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-570089-035
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена подушки двигателя', 400
FROM appointments WHERE firebase_id = '9FgglbCD2Ou2DzSMhtIU'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена шкива генератора', 500
FROM appointments WHERE firebase_id = '9FgglbCD2Ou2DzSMhtIU'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена колодок ручника', 600
FROM appointments WHERE firebase_id = '9FgglbCD2Ou2DzSMhtIU'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задней ступицы', 500
FROM appointments WHERE firebase_id = '9FgglbCD2Ou2DzSMhtIU'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-568360-096 (Олег пассат)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  '9s7dusV36HQPnbrdJJ7u',
  'STO-568360-096',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380987587166' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WVWZZZ3CZFE004735' LIMIT 1),
  '2025-12-02T08:52:48.360Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Записан на 07.01',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-12-02T08:52:48.360Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-568360-096
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Кольца медные под форсунки', 454, 1
FROM appointments WHERE firebase_id = '9s7dusV36HQPnbrdJJ7u'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Сальники форсунок', 532, 1
FROM appointments WHERE firebase_id = '9s7dusV36HQPnbrdJJ7u'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Резинки форсунок', 260, 1
FROM appointments WHERE firebase_id = '9s7dusV36HQPnbrdJJ7u'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Болт форсунок', 150, 1
FROM appointments WHERE firebase_id = '9s7dusV36HQPnbrdJJ7u'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-568360-096
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Записан на 07.01', NULL
FROM appointments WHERE firebase_id = '9s7dusV36HQPnbrdJJ7u'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-616538-858 (Саша cx5)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'AVUPT62z6sTT2JB9VmB0',
  'STO-616538-858',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380978112129' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'JM3KFBXY2S0550549' LIMIT 1),
  '2025-12-02T08:53:36.538Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена задней ступицы 1100',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-12-02T08:53:36.538Z'::TIMESTAMP WITH TIME ZONE,
  '2025-12-22T15:08:38.491Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-616538-858
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Ступица задняя', 1950, 1
FROM appointments WHERE firebase_id = 'AVUPT62z6sTT2JB9VmB0'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-616538-858
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задней ступицы', 1100
FROM appointments WHERE firebase_id = 'AVUPT62z6sTT2JB9VmB0'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-830917-097 (Кирил менеджер )
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'B2rif462w2py1hl86sXA',
  'STO-830917-097',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WBXYJ3C5XKEP77142' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена рычага 700',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-03T20:40:30.917Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-830917-097
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена рычага', 700
FROM appointments WHERE firebase_id = 'B2rif462w2py1hl86sXA'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-772190-482 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'BhnqFtFNriRiPllIlrgd',
  'STO-772190-482',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2026-01-15T06:49:32.190Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена передних гранат 1200',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-15T06:49:32.190Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-772190-482
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Два наружные гранаты', 3212, 1
FROM appointments WHERE firebase_id = 'BhnqFtFNriRiPllIlrgd'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-772190-482
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передних гранат', 1200
FROM appointments WHERE firebase_id = 'BhnqFtFNriRiPllIlrgd'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-868651-600 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'C5RgE77nIuA4SPJXHV8L',
  'STO-868651-600',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-10-28T10:21:08.651Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'ТО 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-28T10:21:08.651Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-28T10:21:17.128Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-868651-600
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'ТО', 500
FROM appointments WHERE firebase_id = 'C5RgE77nIuA4SPJXHV8L'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-747926-150 (Ваня мент)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'CE444CFLLzkkFAaOgEBv',
  'STO-747926-150',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380632286152' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWAT7A30GC041716' LIMIT 1),
  '2025-11-06T08:45:47.926Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена колодок 500',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-06T08:45:47.926Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-08T00:33:24.124Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-747926-150
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена колодок', 500
FROM appointments WHERE firebase_id = 'CE444CFLLzkkFAaOgEBv'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-333191-428 (Сергей)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'EGaSTvqzvkyEbue6tTqq',
  'STO-333191-428',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380977921739' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWLA7A35KC007178' LIMIT 1),
  '2025-10-28T10:12:13.191Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Снятие установка двигателя 8000
Работа с проводкой 1000',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-10-28T10:12:13.191Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-11T19:54:31.620Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-333191-428
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фланец патрубка', 267, 1
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фланец патрубка', 83, 1
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Вентилятор', 1280, 1
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Антифриз', 1137, 1
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-333191-428
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка двигателя', 8000
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Работа с проводкой', 1000
FROM appointments WHERE firebase_id = 'EGaSTvqzvkyEbue6tTqq'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-935325-696 (Сергей Мазда форд)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'FaCFjffODkZj4G1YJhFj',
  'STO-935325-696',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380662433143' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1FMCU0G7XGUA19660' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-03T20:58:55.325Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-935325-696
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Масло', 3272, 1
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр масляный', 324, 1
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр воздушный', 361, 1
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр салона', 385, 1
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Пробка', 21, 1
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-935325-696
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'FaCFjffODkZj4G1YJhFj'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-286143-123 (Ваня)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'FwliJyRDmx4PokLkn72e',
  'STO-286143-123',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '7SAYGDEF3PF595170' LIMIT 1),
  '2025-09-19T23:24:46.143Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Подрамник 350$
Рычаги 3х40 - 120$
Антифриз + вода - 1000грн
Работа замена рычагов и подрамник - 9500
Проставки передок работа 2400 
Проставки 2200 

Итого 470$ и 15100',
  FALSE,
  TRUE,
  NULL,
  NULL,
  '2025-09-19T23:24:46.143Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-16T00:24:41.429Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-286143-123
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Подрамник 350$', NULL
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Рычаги 3х40 - 120$', NULL
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Антифриз + вода - 1000грн', NULL
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Работа замена рычагов и подрамник -', 9500
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Проставки передок работа', 2400
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Проставки', 2200
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Итого 470$ и', 15100
FROM appointments WHERE firebase_id = 'FwliJyRDmx4PokLkn72e'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-221853-575 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'GjjT1DDcFT20jhpOubj2',
  'STO-221853-575',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWSA7A3XNC000341' LIMIT 1),
  '2025-12-02T08:30:21.853Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена втулок переднего стабилизатора 800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-12-02T08:30:21.853Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-221853-575
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена втулок переднего стабилизатора', 800
FROM appointments WHERE firebase_id = 'GjjT1DDcFT20jhpOubj2'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-914699-069 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'HYGCeo0Xixe3TVeEs957',
  'STO-914699-069',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-10-28T10:21:54.699Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена клапанной крышки 1200',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-28T10:21:54.699Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-28T10:22:18.147Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-914699-069
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Болты', 300, 1
FROM appointments WHERE firebase_id = 'HYGCeo0Xixe3TVeEs957'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-914699-069
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена клапанной крышки', 1200
FROM appointments WHERE firebase_id = 'HYGCeo0Xixe3TVeEs957'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-915551-539 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'LUYuAbgT5SuGHx6wplII',
  'STO-915551-539',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWSA7A3XMC006395' LIMIT 1),
  '2025-11-11T14:55:15.552Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-11T14:55:15.552Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-915551-539
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'LUYuAbgT5SuGHx6wplII'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-434892-209 (Яна)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'LeMsLT6aW8Fu367uffCs',
  'STO-434892-209',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380677220501' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBDL41U28B009428' LIMIT 1),
  '2025-12-02T08:33:54.892Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена ГРМ 3200',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-12-02T08:33:54.892Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-15T14:35:01.767Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-434892-209
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Грм', 2919, 1
FROM appointments WHERE firebase_id = 'LeMsLT6aW8Fu367uffCs'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-434892-209
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена ГРМ', 3200
FROM appointments WHERE firebase_id = 'LeMsLT6aW8Fu367uffCs'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-666844-067 (Черный тигуан)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'NsBekf0I6TGlF6HTojCB',
  'STO-666844-067',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '3VVMB7AX4RM112571' LIMIT 1),
  '2025-11-24T09:47:46.844Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена фланца патрубка 300',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-24T09:47:46.844Z'::TIMESTAMP WITH TIME ZONE,
  '2025-12-03T14:19:07.719Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-666844-067
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фланец', 420, 1
FROM appointments WHERE firebase_id = 'NsBekf0I6TGlF6HTojCB'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-666844-067
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена фланца патрубка', 300
FROM appointments WHERE firebase_id = 'NsBekf0I6TGlF6HTojCB'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-014055-568 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'PNlxV50Srjm8ybngFHS9',
  'STO-014055-568',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-12-22T15:40:14.055Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-12-22T15:40:14.055Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-014055-568
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'PNlxV50Srjm8ybngFHS9'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-996682-999 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'QRboHzBRmg2ijpFAjRSS',
  'STO-996682-999',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '2T2HGMDA6MC066035' LIMIT 1),
  '2025-11-06T08:49:56.682Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена передних стоек 2200
Подключение передних противотуманок 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-06T08:49:56.682Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-996682-999
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Косточки переднего стабилизатора', 612, 1
FROM appointments WHERE firebase_id = 'QRboHzBRmg2ijpFAjRSS'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр воздушный', 450, 1
FROM appointments WHERE firebase_id = 'QRboHzBRmg2ijpFAjRSS'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-996682-999
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передних стоек', 2200
FROM appointments WHERE firebase_id = 'QRboHzBRmg2ijpFAjRSS'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Подключение передних противотуманок', 500
FROM appointments WHERE firebase_id = 'QRboHzBRmg2ijpFAjRSS'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-051141-651 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'UaNqKrt0F2BHhRBbukaD',
  'STO-051141-651',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Вопрос не закрыт. ',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2026-01-03T20:44:11.141Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-15T14:35:55.792Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-051141-651
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Вентилятор печки', 4089, 1
FROM appointments WHERE firebase_id = 'UaNqKrt0F2BHhRBbukaD'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-051141-651
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Вопрос не закрыт.', NULL
FROM appointments WHERE firebase_id = 'UaNqKrt0F2BHhRBbukaD'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-318885-460 (Лужный)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'XE2cBgHn3Ue8jqaGJsl6',
  'STO-318885-460',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380680908822' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWCV7A33FC120699' LIMIT 1),
  '2025-11-14T13:01:58.885Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Разборка дыфектовка и сборка передней части 4800
Замена поддона КПП и заливка масла 800
Замена передних стоек 2400
Замена распредвалов 2600
Замена масла и фильтров 500
',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-11-14T13:01:58.885Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-318885-460
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Заглушка', 161, 1
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Подушка двигателя', 2653, 1
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-318885-460
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Разборка дыфектовка и сборка передней части', 4800
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена поддона КПП и заливка масла', 800
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передних стоек', 2400
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена распредвалов', 2600
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла и фильтров', 500
FROM appointments WHERE firebase_id = 'XE2cBgHn3Ue8jqaGJsl6'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-586031-663 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'YiJnxuYE4dqswdTaVuUl',
  'STO-586031-663',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '2T2ADCAZ2NC001148' LIMIT 1),
  '2025-11-14T09:46:26.031Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена подушек двигателя 1200
Замена впускного коллектора 600
Замена шкива компрессора кондиционера 300
Сборка передней части 2000
Работа с проводкой',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-14T09:46:26.031Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-586031-663
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Сервисный ремень', 540, 1
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Нижний патрубок радиатора', 610, 1
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Шкив компрессора кондиционера', 2300, 1
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-586031-663
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена подушек двигателя', 1200
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена впускного коллектора', 600
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена шкива компрессора кондиционера', 300
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Сборка передней части', 2000
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Работа с проводкой', NULL
FROM appointments WHERE firebase_id = 'YiJnxuYE4dqswdTaVuUl'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-553101-043 (Саша)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'Zr54qbu3vJE6NshG6bdu',
  'STO-553101-043',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380978112129' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'JM3KFBXY2S0550549' LIMIT 1),
  '2025-10-14T07:55:53.101Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Установка глушителя 400
Замена заднего нижнего рычага 600',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-10-14T07:55:53.101Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-16T00:24:02.647Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-553101-043
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка глушителя', 400
FROM appointments WHERE firebase_id = 'Zr54qbu3vJE6NshG6bdu'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего нижнего рычага', 600
FROM appointments WHERE firebase_id = 'Zr54qbu3vJE6NshG6bdu'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-829834-861 (Ваня)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'bU6jZx5p0DaYbHVqgtGx',
  'STO-829834-861',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWCS7A32GC063888' LIMIT 1),
  '2025-09-30T07:37:09.835Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Ремонт топливной трубки 500',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-09-30T07:37:09.835Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-18T22:08:01.537Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-829834-861
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Ремонт топливной трубки', 500
FROM appointments WHERE firebase_id = 'bU6jZx5p0DaYbHVqgtGx'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-327840-840 (Никита)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'cMJO11Mll50WmnZa2WVi',
  'STO-327840-840',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380508644079' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5YJ3E1EB4PF653893' LIMIT 1),
  '2025-11-28T14:15:27.840Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Снятие установка переднего подрамника 2000 
Снятие установка двигателя переднего 1800
Замена сайлентблоков переднего двигателя 1200',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-28T14:15:27.840Z'::TIMESTAMP WITH TIME ZONE,
  '2025-12-01T11:53:41.233Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-327840-840
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Развал', 600, 1
FROM appointments WHERE firebase_id = 'cMJO11Mll50WmnZa2WVi'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-327840-840
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка переднего подрамника', 2000
FROM appointments WHERE firebase_id = 'cMJO11Mll50WmnZa2WVi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка двигателя переднего', 1800
FROM appointments WHERE firebase_id = 'cMJO11Mll50WmnZa2WVi'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена сайлентблоков переднего двигателя', 1200
FROM appointments WHERE firebase_id = 'cMJO11Mll50WmnZa2WVi'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-867625-964 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'cWgTDZlD1i2ZUgit5fIq',
  'STO-867625-964',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWSA7A3XMC006395' LIMIT 1),
  '2025-11-06T08:47:47.625Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена переднего левого рычага 800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-06T08:47:47.625Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-867625-964
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена переднего левого рычага', 800
FROM appointments WHERE firebase_id = 'cWgTDZlD1i2ZUgit5fIq'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-132089-974 (Мои авто)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'cWw4eZpdoXkjs7dhzGf9',
  'STO-132089-974',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380953552553' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '7SAYGDEF3PF800681' LIMIT 1),
  '2025-10-07T11:22:12.089Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'scheduled',
  'Сборка передней правой ходовой с установкой полуоси 1200
Снятие установка радиатора 400
Установка проставок 2000
Сборка дверей 1000',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-10-07T11:22:12.089Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-15T20:23:51.928Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-132089-974
INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Передний рычаг правый'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Банан передний правый'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Подкова передняя правая'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Датчик АБС передний'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Ступица передняя'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Полуось в сборе передняя'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Шланг тормозной передний правый'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Задняя правая лодочка (рычаг)'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Антифриз 6л'
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-132089-974
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Сборка передней правой ходовой с установкой полуоси', 1200
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка радиатора', 400
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка проставок', 2000
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Сборка дверей', 1000
FROM appointments WHERE firebase_id = 'cWw4eZpdoXkjs7dhzGf9'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-487161-383 (Яна)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'dFkjzYQlywLjnLTaeXNI',
  'STO-487161-383',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380677220501' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBDL41U28B009428' LIMIT 1),
  '2025-10-28T10:14:47.161Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Снятие установка генератора 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-28T10:14:47.161Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-28T10:15:10.974Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-487161-383
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка генератора', 500
FROM appointments WHERE firebase_id = 'dFkjzYQlywLjnLTaeXNI'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-181685-578 (Пассат белый от витя)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'dX0VApDxOolZHoKn4mfl',
  'STO-181685-578',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380666067066' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '1VWBN7A36DC105185' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '13:00',
  'archived',
  'Замена масло стакана 1200',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2026-01-03T21:03:01.685Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-15T14:34:04.312Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-181685-578
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Масло стакан с теплообменником', 3263, 1
FROM appointments WHERE firebase_id = 'dX0VApDxOolZHoKn4mfl'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-181685-578
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масло стакана', 1200
FROM appointments WHERE firebase_id = 'dX0VApDxOolZHoKn4mfl'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-363635-562 (Саша)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'fvXWywJiJYVF5PO1KwAj',
  'STO-363635-562',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-10-10T10:32:43.635Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена задних амортизаторов 800
Замена термостата 1000
Ремонт сливной пробки 200
Ремонт проводки 400',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-10T10:32:43.635Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-10T14:38:26.964Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-363635-562
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задних амортизаторов', 800
FROM appointments WHERE firebase_id = 'fvXWywJiJYVF5PO1KwAj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена термостата', 1000
FROM appointments WHERE firebase_id = 'fvXWywJiJYVF5PO1KwAj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Ремонт сливной пробки', 200
FROM appointments WHERE firebase_id = 'fvXWywJiJYVF5PO1KwAj'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Ремонт проводки', 400
FROM appointments WHERE firebase_id = 'fvXWywJiJYVF5PO1KwAj'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-248819-021 (Кирил менеджер )
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'gDiyj1xe90FOriFuvjZW',
  'STO-248819-021',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCA41Z68B154047' LIMIT 1),
  '2026-01-07T00:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '',
  'in_progress',
  'Замена ГРМ 3500
Замена тормозного цилиндра 800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-06T11:50:48.819Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-248819-021
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Главный тормозной цилиндр', 2998, 1
FROM appointments WHERE firebase_id = 'gDiyj1xe90FOriFuvjZW'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Комплект ГРМ', 3235, 1
FROM appointments WHERE firebase_id = 'gDiyj1xe90FOriFuvjZW'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-248819-021
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена ГРМ', 3500
FROM appointments WHERE firebase_id = 'gDiyj1xe90FOriFuvjZW'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена тормозного цилиндра', 800
FROM appointments WHERE firebase_id = 'gDiyj1xe90FOriFuvjZW'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-094773-800 (Женя пассат)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'gbVHnM1dP4jKcTMAdsRI',
  'STO-094773-800',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380976998888' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WVWZZZ3CZGE013221' LIMIT 1),
  '2025-11-14T09:54:54.773Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Регулировка сцепления 3700',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-14T09:54:54.773Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-15T00:09:01.184Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-094773-800
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Регулировка сцепления', 3700
FROM appointments WHERE firebase_id = 'gbVHnM1dP4jKcTMAdsRI'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-732339-867 (Саша cx5)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'h5W6FWFsC6fr3Tw6ADGT',
  'STO-732339-867',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380978112129' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'JM3KFBXY2S0550549' LIMIT 1),
  '2025-10-14T07:58:52.339Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена заднего поперечного рычага 400
Замена передней ступицы 800',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-10-14T07:58:52.339Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-08T17:49:26.407Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-732339-867
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Ступица передняя', 1952, 1
FROM appointments WHERE firebase_id = 'h5W6FWFsC6fr3Tw6ADGT'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-732339-867
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего поперечного рычага', 400
FROM appointments WHERE firebase_id = 'h5W6FWFsC6fr3Tw6ADGT'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передней ступицы', 800
FROM appointments WHERE firebase_id = 'h5W6FWFsC6fr3Tw6ADGT'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-508241-380 (Черный тигуан)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'iso1J3VEynSacN3lY5EB',
  'STO-508241-380',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WVGRV7AXXHK003545' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-03T20:51:48.241Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-508241-380
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Масло', 1984, 1
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр масла', 465, 1
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр воздушный', 394, 1
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр салона', 372, 1
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Пробка', 152, 1
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-508241-380
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'iso1J3VEynSacN3lY5EB'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-707799-590 (Мои авто )
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'ivoIfeIor3VWs30goRhx',
  'STO-707799-590',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380953552553' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '7SAYGDEF6RF080697' LIMIT 1),
  '2025-11-06T09:01:47.799Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'scheduled',
  'Сборка передней правой ходовой 1200
Установка проставок 2000',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-11-06T09:01:47.799Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-15T20:23:48.101Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-707799-590
INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Полуось передняя'
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Наконечник рулевой'
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Шланг тормозной'
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Датчик АБС передний'
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description)
SELECT id, 'Подкова правая'
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-707799-590
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Сборка передней правой ходовой', 1200
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка проставок', 2000
FROM appointments WHERE firebase_id = 'ivoIfeIor3VWs30goRhx'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-601066-998 (Ваня)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'lbbhK6XnDGjXMnBQgamD',
  'STO-601066-998',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '7SAYGDEF3PF595170' LIMIT 1),
  '2025-09-30T07:33:21.067Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена задней ступицы 800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-09-30T07:33:21.067Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-06T01:27:27.512Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-601066-998
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задней ступицы', 800
FROM appointments WHERE firebase_id = 'lbbhK6XnDGjXMnBQgamD'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-206030-820 (Кирил менеджер )
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'mWG8IKn9XdZPAEPOzRBY',
  'STO-206030-820',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5YJ3E1EB3NF135447' LIMIT 1),
  '2025-11-14T09:40:06.030Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена рейки 2800
Замена задней ступицы 800',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-14T09:40:06.030Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-18T22:08:08.556Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-206030-820
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена рейки', 2800
FROM appointments WHERE firebase_id = 'mWG8IKn9XdZPAEPOzRBY'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена задней ступицы', 800
FROM appointments WHERE firebase_id = 'mWG8IKn9XdZPAEPOzRBY'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-552065-820 (Саша)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'n6Ixhcj5adDVk5q3QIpD',
  'STO-552065-820',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBCK7NE8F0196671' LIMIT 1),
  '2025-10-07T11:12:32.065Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  '07.10
Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-07T11:12:32.065Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-07T11:23:39.588Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-552065-820
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, '07.10', NULL
FROM appointments WHERE firebase_id = 'n6Ixhcj5adDVk5q3QIpD'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'n6Ixhcj5adDVk5q3QIpD'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-029387-626 (Маша)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'ogdpjZgtKmShJyNOkAe0',
  'STO-029387-626',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380968872028' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '3MZBN1V74HM122646' LIMIT 1),
  '2025-12-04T00:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  '',
  'archived',
  'Замена колодок 600
Замена фильтра салона 200
Диагностика ходовой 500',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-12-03T11:07:09.387Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-06T10:14:33.059Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  TRUE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-029387-626
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Колодки передние', 1030, 1
FROM appointments WHERE firebase_id = 'ogdpjZgtKmShJyNOkAe0'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр салона', 151, 1
FROM appointments WHERE firebase_id = 'ogdpjZgtKmShJyNOkAe0'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-029387-626
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена колодок', 600
FROM appointments WHERE firebase_id = 'ogdpjZgtKmShJyNOkAe0'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена фильтра салона', 200
FROM appointments WHERE firebase_id = 'ogdpjZgtKmShJyNOkAe0'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Диагностика ходовой', 500
FROM appointments WHERE firebase_id = 'ogdpjZgtKmShJyNOkAe0'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-685580-657 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'qBYXaSjIuieqX7d6GiKH',
  'STO-685580-657',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'WBAJA5C54KWW14813' LIMIT 1),
  '2026-01-13T14:14:45.580Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Сборка ходовой передней левой стороны 2800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-13T14:14:45.580Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-13T21:13:17.422Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-685580-657
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Тяга рулевая', 1643, 1
FROM appointments WHERE firebase_id = 'qBYXaSjIuieqX7d6GiKH'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-685580-657
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Сборка ходовой передней левой стороны', 2800
FROM appointments WHERE firebase_id = 'qBYXaSjIuieqX7d6GiKH'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-796350-119 (Сергей Мазда форд)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'sGOPF7Glyvc4dktP9wvB',
  'STO-796350-119',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380662433143' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'JM3KFBBM9P0193205' LIMIT 1),
  '2025-12-14T22:00:00.000Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена масла 500',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2026-01-03T20:56:36.350Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-796350-119
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр масляный', 426, 1
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр воздушный', 459, 1
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Фильтр салона', 357, 1
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Кольцо пробки', 4, 1
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Масла', 3272, 1
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-796350-119
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена масла', 500
FROM appointments WHERE firebase_id = 'sGOPF7Glyvc4dktP9wvB'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-767540-811 (Черный тигуан)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'v1c16hoxpEzSgZFqFLWI',
  'STO-767540-811',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '3VV8B7AX5RM108501' LIMIT 1),
  '2025-11-24T09:49:27.540Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Снятие установка двигателя 8000',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-24T09:49:27.540Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-767540-811
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Снятие установка двигателя', 8000
FROM appointments WHERE firebase_id = 'v1c16hoxpEzSgZFqFLWI'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-370103-095 (Данил)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'v2yBvGyCDzyEcPhrqZ8s',
  'STO-370103-095',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380638863200' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5YJYGDEE5MF204908' LIMIT 1),
  '2025-09-25T10:49:30.103Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена заднего подрамника 9500
Замена заднего поворотного кулака 800
Зарядка 12 вольтового аккумулятора 300
Диагностика ходовой 400
Зарядка автомобиля 800
Замена колес 200
Прокачка антифриза 300


',
  TRUE,
  FALSE,
  NULL,
  NULL,
  '2025-09-25T10:49:30.103Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-16T00:44:41.255Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-370103-095
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Антифриз 2л', 800, 1
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Датчик АБС задний', 600, 1
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-370103-095
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего подрамника', 9500
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего поворотного кулака', 800
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Зарядка 12 вольтового аккумулятора', 300
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Диагностика ходовой', 400
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Зарядка автомобиля', 800
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена колес', 200
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Прокачка антифриза', 300
FROM appointments WHERE firebase_id = 'v2yBvGyCDzyEcPhrqZ8s'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-156084-273 (Саша шкода)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'v4wWf1GMV9xmQZXrdLFO',
  'STO-156084-273',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'VF1HJD40365976950' LIMIT 1),
  '2025-12-02T08:29:16.084Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена ступичного подшипника и датчика АБС 1300',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-12-02T08:29:16.084Z'::TIMESTAMP WITH TIME ZONE,
  '2025-12-03T14:20:30.121Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-156084-273
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Подшипник ступицы', 1226, 1
FROM appointments WHERE firebase_id = 'v4wWf1GMV9xmQZXrdLFO'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Датчик АБС задний', 642, 1
FROM appointments WHERE firebase_id = 'v4wWf1GMV9xmQZXrdLFO'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-156084-273
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена ступичного подшипника и датчика АБС', 1300
FROM appointments WHERE firebase_id = 'v4wWf1GMV9xmQZXrdLFO'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-052680-089 (Влад)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'wABWQnmxX2m2NYhPsJTv',
  'STO-052680-089',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380982326100' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'SYJ3E1EAXRF865806' LIMIT 1),
  '2025-11-06T09:07:32.680Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Разборка дыфектовка и сборка морды 2500',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-11-06T09:07:32.680Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-08T17:49:13.096Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-052680-089
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Разборка дыфектовка и сборка морды', 2500
FROM appointments WHERE firebase_id = 'wABWQnmxX2m2NYhPsJTv'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-807425-845 (Яна)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'wGA9pizXmXb552QMXsIs',
  'STO-807425-845',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380677220501' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = 'TMBDL41U28B009428' LIMIT 1),
  '2025-10-28T10:20:07.425Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена передних стоек 1600
Замена лямбдазонда 300
Замена наконечников 600
Замена втулок стабилизатора 600
Замена косточек стабилизатора 300',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-10-28T10:20:07.425Z'::TIMESTAMP WITH TIME ZONE,
  '2025-11-02T20:24:39.711Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-807425-845
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Стойки передние', 4946, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Опора амортизатора', 890, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Лямбда зонд', 2705, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Наконечник рулевой правый', 409, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Наконечник рулевой левый', 386, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Стойки стабилизатора', 936, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Втулки стабилизатора', 274, 1
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-807425-845
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена передних стоек', 1600
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена лямбдазонда', 300
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена наконечников', 600
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена втулок стабилизатора', 600
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена косточек стабилизатора', 300
FROM appointments WHERE firebase_id = 'wGA9pizXmXb552QMXsIs'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-201707-426 (Ваня)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'xMGwMOiFT0XiMgui2oJ7',
  'STO-201707-426',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '7SAYGDEF3PF595170' LIMIT 1),
  '2025-10-07T11:23:21.707Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена ступицы задней 800',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-10-07T11:23:21.707Z'::TIMESTAMP WITH TIME ZONE,
  '2025-10-07T11:23:45.862Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-201707-426
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена ступицы задней', 800
FROM appointments WHERE firebase_id = 'xMGwMOiFT0XiMgui2oJ7'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-723523-206 (Тесла хайленд)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'yZmrNWgfe9lN0TqbCunB',
  'STO-723523-206',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380999363557' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5YJ3E1EB7RF800873' LIMIT 1),
  '2025-12-30T10:48:43.524Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'archived',
  'Замена заднего подрамника 8000
Замена заднего поворотного кулака 1200
Шиномонтаж 300
Эвакуатор 1800',
  TRUE,
  TRUE,
  NULL,
  NULL,
  '2025-12-30T10:48:43.524Z'::TIMESTAMP WITH TIME ZONE,
  '2026-01-05T18:52:38.810Z'::TIMESTAMP WITH TIME ZONE,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Работы для заявки STO-723523-206
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего подрамника', 8000
FROM appointments WHERE firebase_id = 'yZmrNWgfe9lN0TqbCunB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена заднего поворотного кулака', 1200
FROM appointments WHERE firebase_id = 'yZmrNWgfe9lN0TqbCunB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Шиномонтаж', 300
FROM appointments WHERE firebase_id = 'yZmrNWgfe9lN0TqbCunB'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Эвакуатор', 1800
FROM appointments WHERE firebase_id = 'yZmrNWgfe9lN0TqbCunB'
ON CONFLICT (appointment_id, description) DO NOTHING;


-- Заявка: STO-799589-798 (Валидол)
INSERT INTO appointments (
  firebase_id,
  request_number,
  sto_company_id,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  'zo28Ima3KgBHcsQdwvC1',
  'STO-799589-798',
  'e0e2202a-e4c2-4505-8b4c-07037cb64281',
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = '5YJ3E1EA7RF813419' LIMIT 1),
  '2025-11-28T14:23:19.589Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'in_progress',
  'Замена рулевого наконечника 500
Установка стекол в левые двери 600
Замена рулевой тяги 300
Установка передней защиты 200
Прошивка сим карты 1000',
  FALSE,
  FALSE,
  NULL,
  NULL,
  '2025-11-28T14:23:19.589Z'::TIMESTAMP WITH TIME ZONE,
  NULL,
  'Паша',
  FALSE,
  NULL, -- created_by (заполнить вручную)
  NULL
)
ON CONFLICT (request_number) DO NOTHING;

-- Запчасти для заявки STO-799589-798
INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, 'Рулевая тяга', 1000, 1
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;

-- Работы для заявки STO-799589-798
INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена рулевого наконечника', 500
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка стекол в левые двери', 600
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Замена рулевой тяги', 300
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Установка передней защиты', 200
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;

INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, 'Прошивка сим карты', 1000
FROM appointments WHERE firebase_id = 'zo28Ima3KgBHcsQdwvC1'
ON CONFLICT (appointment_id, description) DO NOTHING;


COMMIT;

-- ============================================================
-- СТАТИСТИКА ИМПОРТА:
-- ============================================================
-- Обработано заявок: 53
-- Пропущено: 8
-- Ошибок: 0

