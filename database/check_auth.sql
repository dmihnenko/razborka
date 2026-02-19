-- Проверить текущего пользователя
SELECT auth.uid() as current_user_id;

-- Показать всех пользователей
SELECT 
    id,
    username,
    parts_company_id,
    sto_company_id
FROM user_profiles
LIMIT 5;
