-- Добавление поля username для альтернативного входа
-- Пользователь может войти либо по email, либо по username

-- Добавляем email в user_profiles (копия из auth.users для удобства поиска)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Добавляем username
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Добавляем поле для хранения пароля (чтобы владельцы видели пароли своих работников)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Комментарии
COMMENT ON COLUMN user_profiles.email IS 'Email пользователя (копия из auth.users для удобства)';
COMMENT ON COLUMN user_profiles.username IS 'Уникальный логин для входа в систему (альтернатива email)';
COMMENT ON COLUMN user_profiles.plain_password IS 'Пароль в открытом виде (для просмотра владельцами своих работников)';

-- Функция для синхронизации email из auth.users в user_profiles
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического заполнения email при создании профиля
DROP TRIGGER IF EXISTS sync_user_email_trigger ON user_profiles;
CREATE TRIGGER sync_user_email_trigger
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

-- Обновляем существующие записи
UPDATE user_profiles up
SET email = (SELECT email FROM auth.users WHERE id = up.id)
WHERE email IS NULL;

