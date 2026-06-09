-- Разрешаем удаление пользователя из auth.users.
-- «Database error deleting user» = FK на auth.users без ON DELETE CASCADE.
-- Пересоздаём FK личных таблиц (роли, заявка, профиль) с ON DELETE CASCADE.
-- Примечание: conkey — int2vector, поэтому кастуем в smallint[] для ANY().

-- user_roles.user_id -> auth.users(id)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey::smallint[])
    WHERE con.conrelid = 'public.user_roles'::regclass
      AND con.contype = 'f' AND a.attname = 'user_id'
  LOOP
    EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- access_requests.user_id -> auth.users(id)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey::smallint[])
    WHERE con.conrelid = 'public.access_requests'::regclass
      AND con.contype = 'f' AND a.attname = 'user_id'
  LOOP
    EXECUTE 'ALTER TABLE public.access_requests DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_user_id_fkey;
  ALTER TABLE public.access_requests
    ADD CONSTRAINT access_requests_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- user_profiles.id -> auth.users(id)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey::smallint[])
    WHERE con.conrelid = 'public.user_profiles'::regclass
      AND con.contype = 'f' AND a.attname = 'id'
  LOOP
    EXECUTE 'ALTER TABLE public.user_profiles DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
  ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';
