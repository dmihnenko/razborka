-- Добавляем поле real_email в user_profiles для хранения реального email пользователя
-- (отдельно от технического email в auth.users)

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS real_email text;

-- Добавляем индекс для быстрого поиска по real_email
CREATE INDEX IF NOT EXISTS idx_user_profiles_real_email ON user_profiles(real_email);

-- Обновляем триггер для сохранения username и real_email из метаданных
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, phone, username, real_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'username', ''),
    COALESCE(new.raw_user_meta_data->>'real_email', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Пересоздаем триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Комментарии
COMMENT ON COLUMN user_profiles.real_email IS 'Реальный email пользователя (может отличаться от auth.users.email, который используется только для аутентификации)';
