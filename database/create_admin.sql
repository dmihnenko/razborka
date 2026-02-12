-- Создание профиля администратора для d070988m@gmail.com

-- Получаем ID пользователя по email
DO $$
DECLARE
  user_id uuid;
  admin_role_id uuid;
BEGIN
  -- Находим пользователя по email
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = 'd070988m@gmail.com' 
  LIMIT 1;
  
  -- Находим роль admin
  SELECT id INTO admin_role_id 
  FROM roles 
  WHERE name = 'admin' 
  LIMIT 1;
  
  IF user_id IS NOT NULL AND admin_role_id IS NOT NULL THEN
    -- Создаем или обновляем профиль пользователя
    INSERT INTO user_profiles (id, full_name, role_id, is_active)
    VALUES (user_id, 'Administrator', admin_role_id, true)
    ON CONFLICT (id) DO UPDATE
    SET role_id = admin_role_id,
        is_active = true;
    
    RAISE NOTICE 'Пользователь d070988m@gmail.com успешно назначен администратором';
  ELSE
    IF user_id IS NULL THEN
      RAISE NOTICE 'Пользователь с email d070988m@gmail.com не найден. Пожалуйста, сначала зарегистрируйтесь в системе.';
    END IF;
    IF admin_role_id IS NULL THEN
      RAISE NOTICE 'Роль admin не найдена в таблице roles';
    END IF;
  END IF;
END $$;
