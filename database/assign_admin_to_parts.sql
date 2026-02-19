-- Убрать mng из владельцев разборки
UPDATE user_profiles 
SET parts_company_id = NULL
WHERE username = 'mng';

-- Назначить админа (первый пользователь) владельцем разборки Dnipro Tesla
UPDATE user_profiles 
SET parts_company_id = 'ca1ac19d-0254-4c0b-8ced-cc38da52053d'
WHERE id = '57e55c70-7f65-43d2-b874-8af94d99a8c3'
RETURNING id, username, parts_company_id, sto_company_id;
