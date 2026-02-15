-- Импорт клиентов и автомобилей из Firebase бэкапа
-- Дата генерации: 2026-02-13T20:35:33.467Z
-- Клиентов: 23
-- Автомобилей: 38

BEGIN;

-- ============================================================
-- ИМПОРТ КЛИЕНТОВ
-- ============================================================

-- Клиент: Юра
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Юра',
  '380509298505',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Саша шкода
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Саша шкода',
  '380672545958',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Влад кум
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Влад кум',
  '380679710006',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Кирил менеджер 
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Кирил менеджер ',
  '380665333044',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Валидол
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Валидол',
  '380634296840',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Антон
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Антон',
  '380671666969',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Олег пассат
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Олег пассат',
  '380987587166',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Саша cx5
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Саша cx5',
  '380978112129',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Ваня мент
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Ваня мент',
  '380632286152',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Сергей
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Сергей',
  '380977921739',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Сергей Мазда форд
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Сергей Мазда форд',
  '380662433143',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Ваня
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Ваня',
  '380952759912',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Яна
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Яна',
  '380677220501',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Черный тигуан
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Черный тигуан',
  '380671087060',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Лужный
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Лужный',
  '380680908822',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Никита
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Никита',
  '380508644079',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Мои авто
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Мои авто',
  '380953552553',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Пассат белый от витя
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Пассат белый от витя',
  '380666067066',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Женя пассат
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Женя пассат',
  '380976998888',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Маша
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Маша',
  '380968872028',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Данил
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Данил',
  '380638863200',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Влад
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Влад',
  '380982326100',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

-- Клиент: Тесла хайленд
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  'Тесла хайленд',
  '380999363557',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);


-- ============================================================
-- ИМПОРТ АВТОМОБИЛЕЙ
-- ============================================================

-- Автомобиль: Toyota camry  (2024)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380509298505' LIMIT 1),
  'Toyota camry',
  '',
  2024,
  '4T1KZ1AK8PU085334',
  'camry',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Шкода  (2016)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  'Шкода',
  '',
  2016,
  'TMBCK7NE8F0196671',
  'Шкода',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: BMW X5  (2026)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380679710006' LIMIT 1),
  'BMW X5',
  '',
  2026,
  'WBAFB710X0LX77387',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Nissan   (2010)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380679710006' LIMIT 1),
  'Nissan ',
  '',
  2010,
  'VSKJVWR51U0003144',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Nissan rogue   (2021)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  'Nissan rogue ',
  '',
  2021,
  '5N1AT3BA6MC810252',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat   (2021)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'Passat ',
  '',
  2021,
  '1VWSA7A3XNC000341',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Kia cerato  (2008)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380671666969' LIMIT 1),
  'Kia cerato',
  '',
  2008,
  'JMZBK12Z551166370',
  'cerato',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat  (2015)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380987587166' LIMIT 1),
  'Passat',
  '',
  2015,
  'WVWZZZ3CZFE004735',
  'Passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Mazda cx5  (2024)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380978112129' LIMIT 1),
  'Mazda cx5',
  '',
  2024,
  'JM3KFBXY2S0550549',
  'cx5',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: BMW  (2019)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  'BMW',
  '',
  2019,
  'WBXYJ3C5XKEP77142',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat  (2025)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380632286152' LIMIT 1),
  'Passat',
  '',
  2025,
  '1VWAT7A30GC041716',
  'Passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Volkswagen passat  (2019)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380977921739' LIMIT 1),
  'Volkswagen passat',
  '',
  2019,
  '1VWLA7A35KC007178',
  'passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Ford Mondeo  (2016)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380662433143' LIMIT 1),
  'Ford Mondeo',
  '',
  2016,
  '1FMCU0G7XGUA19660',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat  (2025)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'Passat',
  '',
  2025,
  '1VWSA7A3XMC006395',
  'Passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Skoda Octavia   (2008)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380677220501' LIMIT 1),
  'Skoda Octavia ',
  '',
  2008,
  'TMBDL41U28B009428',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tiguan  (2020)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  'Tiguan',
  '',
  2020,
  '3VVMB7AX4RM112571',
  'Tiguan',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Lexus rx  (2022)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'Lexus rx',
  '',
  2022,
  '2T2HGMDA6MC066035',
  'rx',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat  (2016)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380680908822' LIMIT 1),
  'Passat',
  '',
  2016,
  '1VWCV7A33FC120699',
  'Passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Lexus nx  (2021)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'Lexus nx',
  '',
  2021,
  '2T2ADCAZ2NC001148',
  'nx',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Volkswagen passat  (2018)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  'Volkswagen passat',
  '',
  2018,
  '1VWCS7A32GC063888',
  'passat',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla 3   (2022)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380508644079' LIMIT 1),
  'Tesla 3 ',
  '',
  2022,
  '5YJ3E1EB4PF653893',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: TeslaY   (2023)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380953552553' LIMIT 1),
  'TeslaY ',
  '',
  2023,
  '7SAYGDEF3PF800681',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Volkswagen Passat  (2013)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380666067066' LIMIT 1),
  'Volkswagen Passat',
  '',
  2013,
  '1VWBN7A36DC105185',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Škoda Octavia II  (2008)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  'Škoda Octavia II',
  '',
  2008,
  'TMBCA41Z68B154047',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Passat   (2016)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380976998888' LIMIT 1),
  'Passat ',
  '',
  2016,
  'WVWZZZ3CZGE013221',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Volkswagen  (2017)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  'Volkswagen',
  '',
  2017,
  'WVGRV7AXXHK003545',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla Y   (2024)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380953552553' LIMIT 1),
  'Tesla Y ',
  '',
  2024,
  '7SAYGDEF6RF080697',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla Model Y Perfomance  (2023)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380952759912' LIMIT 1),
  'Tesla Model Y Perfomance',
  '',
  2023,
  '7SAYGDEF3PF595170',
  'Perfomance',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla 3  (2022)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380665333044' LIMIT 1),
  'Tesla 3',
  '',
  2022,
  '5YJ3E1EB3NF135447',
  '3',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Mazda 3   (2017)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380968872028' LIMIT 1),
  'Mazda 3 ',
  '',
  2017,
  '3MZBN1V74HM122646',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: BMW  (2019)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'BMW',
  '',
  2019,
  'WBAJA5C54KWW14813',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Mazda CX-5  (2023)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380662433143' LIMIT 1),
  'Mazda CX-5',
  '',
  2023,
  'JM3KFBBM9P0193205',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tiguan  (2021)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380671087060' LIMIT 1),
  'Tiguan',
  '',
  2021,
  '3VV8B7AX5RM108501',
  'Tiguan',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla Y  (2021)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380638863200' LIMIT 1),
  'Tesla Y',
  '',
  2021,
  '5YJYGDEE5MF204908',
  'Y',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Reno daster  (2015)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380672545958' LIMIT 1),
  'Reno daster',
  '',
  2015,
  'VF1HJD40365976950',
  'daster',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla 3  (2024)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380982326100' LIMIT 1),
  'Tesla 3',
  '',
  2024,
  'SYJ3E1EAXRF865806',
  '3',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla Model 3  (2024)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380999363557' LIMIT 1),
  'Tesla Model 3',
  '',
  2024,
  '5YJ3E1EB7RF800873',
  '',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

-- Автомобиль: Tesla 3   (2025)
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = '380634296840' LIMIT 1),
  'Tesla 3 ',
  '',
  2025,
  '5YJ3E1EA7RF813419',
  'N/A',
  NULL,
  NULL
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);


COMMIT;

-- ============================================================
-- СТАТИСТИКА
-- ============================================================
-- Импортировано клиентов: 23
-- Импортировано автомобилей: 38
