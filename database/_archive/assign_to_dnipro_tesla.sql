-- Назначить текущего пользователя к компании Dnipro Tesla
UPDATE user_profiles 
SET parts_company_id = 'ca1ac19d-0254-4c0b-8ced-cc38da52053d'
WHERE id = auth.uid()
RETURNING id, username, parts_company_id, sto_company_id;
