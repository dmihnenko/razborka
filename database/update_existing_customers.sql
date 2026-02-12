-- Обновляем существующих клиентов, присваивая им sto_company_id
-- Берем первую доступную компанию из sto_companies

-- Показываем клиентов без компании
select id, name, phone, sto_company_id 
from customers 
where sto_company_id is null;

-- Обновляем клиентов без компании, присваивая им первую STO компанию
-- ВАЖНО: Раскомментируйте следующие строки после проверки что они правильные

-- update customers
-- set sto_company_id = (select id from sto_companies limit 1)
-- where sto_company_id is null;

-- Альтернатива: присвоить компанию конкретного пользователя
-- Замените USER_ID на ID вашего пользователя из user_profiles

-- update customers
-- set sto_company_id = (
--   select sto_company_id from user_profiles where id = 'a345e667-6a2d-4c49-a321-a39738e76b2d'
-- )
-- where sto_company_id is null;

-- Проверяем результат
select 
  c.id, 
  c.name, 
  c.phone, 
  c.sto_company_id,
  sc.name as company_name
from customers c
left join sto_companies sc on c.sto_company_id = sc.id;
