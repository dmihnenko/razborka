-- Триггер создания профиля при регистрации: теперь заполняем и email
-- (вход в систему по email), а не только real_email. Идемпотентно.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, phone, username, email, real_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    NULLIF(new.raw_user_meta_data->>'username', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'real_email', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

NOTIFY pgrst, 'reload schema';
