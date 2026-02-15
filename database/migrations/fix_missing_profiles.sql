-- Создаем профили для пользователей, у которых их нет

INSERT INTO user_profiles (id, email, full_name, is_active)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1), 'User') as full_name,
  true as is_active
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- Проверяем результат
SELECT COUNT(*) as created_profiles FROM user_profiles 
WHERE created_at > NOW() - INTERVAL '1 minute';
