-- Назначаем роль администратора пользователю Паша
-- ID пользователя: a345e667-6a2d-4c49-a321-a39738e76b2d

-- 1. Проверяем существующие роли пользователя
select 
  up.id,
  up.first_name,
  up.last_name,
  r.name as role_name,
  ur.is_primary
from user_profiles up
left join user_roles ur on ur.user_id = up.id
left join roles r on r.role_id = ur.role_id
where up.id = 'a345e667-6a2d-4c49-a321-a39738e76b2d';

-- 2. Получаем ID роли admin
select id, name from roles where name = 'admin';

-- 3. Назначаем роль admin пользователю (если ее еще нет)
insert into user_roles (user_id, role_id, is_primary, assigned_at)
select 
  'a345e667-6a2d-4c49-a321-a39738e76b2d',
  r.id,
  true, -- делаем основной ролью
  now()
from roles r
where r.name = 'admin'
and not exists (
  select 1 from user_roles ur
  where ur.user_id = 'a345e667-6a2d-4c49-a321-a39738e76b2d'
  and ur.role_id = r.id
);

-- 4. Проверяем результат
select 
  up.id,
  up.first_name,
  up.last_name,
  r.name as role_name,
  ur.is_primary,
  ur.assigned_at
from user_profiles up
left join user_roles ur on ur.user_id = up.id
left join roles r on r.role_id = ur.role_id
where up.id = 'a345e667-6a2d-4c49-a321-a39738e76b2d';
