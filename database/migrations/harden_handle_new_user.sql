-- Защищаем создание пользователя (вкл. OAuth/Google) от падения триггера.
-- Если запись профиля невозможна (дубль email/username и т.п.) — НЕ роняем
-- создание auth-пользователя, а просто пропускаем вставку профиля.
-- Профиль при необходимости до-создаётся позже (claim_personal_user_role / админ).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone, username, email, real_email)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
      COALESCE(new.raw_user_meta_data->>'phone', ''),
      NULLIF(new.raw_user_meta_data->>'username', ''),
      new.email,
      COALESCE(new.raw_user_meta_data->>'real_email', new.email)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Любая ошибка вставки профиля не должна блокировать регистрацию/вход
    NULL;
  END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

NOTIFY pgrst, 'reload schema';
