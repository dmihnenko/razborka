-- Проверка недостающих клиентов и автомобилей для импорта заявок

-- ============================================================
-- НЕДОСТАЮЩИЕ КЛИЕНТЫ (по телефону)
-- ============================================================

WITH backup_clients AS (
  SELECT DISTINCT clientPhone, clientName FROM (VALUES
    ('380509298505', 'Юра'),
    ('380672545958', 'Саша шкода'),
    ('380679710006', 'Влад кум'),
    ('380665333044', 'Кирил менеджер '),
    ('380634296840', 'Валидол'),
    ('380671666969', 'Антон'),
    ('380987587166', 'Олег пассат'),
    ('380978112129', 'Саша cx5'),
    ('380977921739', 'Сергей'),
    ('380662433143', 'Сергей Мазда форд'),
    ('380952759912', 'Ваня'),
    ('380632286152', 'Ваня мент'),
    ('380677220501', 'Яна'),
    ('380671087060', 'Черный тигуан'),
    ('380680908822', 'Лужный')
  ) AS t(clientPhone, clientName)
)
SELECT 
  bc.clientPhone as "Телефон",
  bc.clientName as "Имя клиента",
  CASE 
    WHEN c.id IS NULL THEN '❌ ОТСУТСТВУЕТ'
    ELSE '✅ Есть'
  END as "Статус"
FROM backup_clients bc
LEFT JOIN customers c ON c.phone = bc.clientPhone
ORDER BY 
  CASE WHEN c.id IS NULL THEN 0 ELSE 1 END,
  bc.clientName;

-- ============================================================
-- НЕДОСТАЮЩИЕ АВТОМОБИЛИ (по VIN)
-- ============================================================

WITH backup_vehicles AS (
  SELECT DISTINCT vehicleVin, vehicleMake, clientPhone FROM (VALUES
    ('4T1KZ1AK8PU085334', 'Toyota camry', '380509298505'),
    ('TMBCK7NE8F0196671', 'Шкода', '380672545958'),
    ('WBAFB710X0LX77387', 'BMW X5', '380679710006'),
    ('VSKJVWR51U0003144', 'Nissan ', '380679710006'),
    ('5N1AT3BA6MC810252', 'Nissan rogue ', '380665333044'),
    ('1VWSA7A3XNC000341', 'Passat ', '380634296840'),
    ('JMZBK12Z551166370', 'Kia cerato', '380671666969'),
    ('WVWZZZ3CZFE004735', 'Passat', '380987587166'),
    ('JM3KFBXY2S0550549', 'Mazda cx5', '380978112129'),
    ('WBXYJ3C5XKEP77142', 'BMW', '380665333044'),
    ('1VWLA7A35KC007178', 'Volkswagen passat', '380977921739'),
    ('1FMCU0G7XGUA19660', 'Ford Mondeo', '380662433143'),
    ('7SAYGDEF3PF595170', 'Tesla Model Y Perfomance', '380952759912'),
    ('1VWAT7A30GC041716', 'Passat', '380632286152'),
    ('TMBDL41U28B009428', 'Skoda Octavia ', '380677220501'),
    ('3VVMB7AX4RM112571', 'Tiguan', '380671087060'),
    ('IjPee7R9QhdZGDDM2jQO', 'BMW', '380665333044'),
    ('2T2HGMDA6MC066035', 'Lexus rx', '380634296840'),
    ('1VWSA7A3XMC006395', 'Passat', '380634296840'),
    ('7xIyXtCrbHyQTIu1Pp7B', 'Skoda Octavia ', '380677220501'),
    ('1VWCV7A33FC120699', 'Passat', '380680908822'),
    ('2T2ADCAZ2NC001148', 'Lexus nx', '380634296840')
  ) AS t(vehicleVin, vehicleMake, clientPhone)
)
SELECT 
  bv.vehicleVin as "VIN",
  bv.vehicleMake as "Марка",
  bv.clientPhone as "Телефон владельца",
  CASE 
    WHEN v.id IS NULL THEN '❌ ОТСУТСТВУЕТ'
    ELSE '✅ Есть'
  END as "Статус"
FROM backup_vehicles bv
LEFT JOIN vehicles v ON v.vin = bv.vehicleVin
ORDER BY 
  CASE WHEN v.id IS NULL THEN 0 ELSE 1 END,
  bv.vehicleMake;

-- ============================================================
-- СТАТИСТИКА
-- ============================================================

WITH backup_clients AS (
  SELECT DISTINCT clientPhone FROM (VALUES
    ('380509298505'), ('380672545958'), ('380679710006'), ('380665333044'),
    ('380634296840'), ('380671666969'), ('380987587166'), ('380978112129'),
    ('380977921739'), ('380662433143'), ('380952759912'), ('380632286152'),
    ('380677220501'), ('380671087060'), ('380680908822')
  ) AS t(clientPhone)
),
backup_vehicles AS (
  SELECT DISTINCT vehicleVin FROM (VALUES
    ('4T1KZ1AK8PU085334'), ('TMBCK7NE8F0196671'), ('WBAFB710X0LX77387'),
    ('VSKJVWR51U0003144'), ('5N1AT3BA6MC810252'), ('1VWSA7A3XNC000341'),
    ('JMZBK12Z551166370'), ('WVWZZZ3CZFE004735'), ('JM3KFBXY2S0550549'),
    ('WBXYJ3C5XKEP77142'), ('1VWLA7A35KC007178'), ('1FMCU0G7XGUA19660'),
    ('7SAYGDEF3PF595170'), ('1VWAT7A30GC041716'), ('TMBDL41U28B009428'),
    ('3VVMB7AX4RM112571'), ('1VWCV7A33FC120699'), ('2T2ADCAZ2NC001148'),
    ('2T2HGMDA6MC066035'), ('1VWSA7A3XMC006395')
  ) AS t(vehicleVin)
)
SELECT 
  'Клиенты в бэкапе' as "Тип",
  COUNT(*) as "Всего в бэкапе",
  COUNT(c.id) as "Есть в БД",
  COUNT(*) - COUNT(c.id) as "❌ Отсутствует"
FROM backup_clients bc
LEFT JOIN customers c ON c.phone = bc.clientPhone

UNION ALL

SELECT 
  'Автомобили в бэкапе' as "Тип",
  COUNT(*) as "Всего в бэкапе",
  COUNT(v.id) as "Есть в БД",
  COUNT(*) - COUNT(v.id) as "❌ Отсутствует"
FROM backup_vehicles bv
LEFT JOIN vehicles v ON v.vin = bv.vehicleVin;
