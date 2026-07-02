-- Добавление тестовых СТО и разборок для проверки функционала

-- Проверяем, есть ли уже данные
SELECT 'Existing STO companies:' as info;
SELECT id, name FROM sto_companies;

SELECT 'Existing Parts companies:' as info;
SELECT id, name FROM parts_companies;

-- Добавляем тестовые СТО, если их нет
INSERT INTO sto_companies (name, address, phone, email, description, is_active)
SELECT * FROM (VALUES
  ('Автосервис "Профи"', 'ул. Ленина, 10', '+380 50 123-45-67', 'profi@sto.ua', 'Профессиональный ремонт всех марок автомобилей', true),
  ('СТО "Мастер"', 'ул. Киевская, 25', '+380 67 234-56-78', 'master@sto.ua', 'Комплексное обслуживание и ремонт', true),
  ('Автомастерская "Эксперт"', 'пр. Победы, 100', '+380 93 345-67-89', 'expert@sto.ua', 'Диагностика и ремонт любой сложности', true)
) AS new_companies(name, address, phone, email, description, is_active)
WHERE NOT EXISTS (SELECT 1 FROM sto_companies LIMIT 1);

-- Добавляем тестовые разборки, если их нет
INSERT INTO parts_companies (name, address, phone, email, description, is_active)
SELECT * FROM (VALUES
  ('Разборка "Запчасти+"', 'ул. Промышленная, 5', '+380 50 111-22-33', 'parts@razborka.ua', 'Большой выбор б/у запчастей', true),
  ('АвтоРазбор "Комплект"', 'ул. Заводская, 15', '+380 67 222-33-44', 'komplekt@razborka.ua', 'Запчасти для всех марок', true)
) AS new_companies(name, address, phone, email, description, is_active)
WHERE NOT EXISTS (SELECT 1 FROM parts_companies LIMIT 1);

-- Проверяем результат
SELECT 'STO companies after insert:' as info;
SELECT id, name, is_active FROM sto_companies ORDER BY name;

SELECT 'Parts companies after insert:' as info;
SELECT id, name, is_active FROM parts_companies ORDER BY name;
