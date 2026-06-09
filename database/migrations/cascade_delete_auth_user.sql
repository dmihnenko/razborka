-- Разрешаем удаление пользователя из auth.users.
-- «Database error deleting user» = FK на auth.users без ON DELETE CASCADE.
-- Каскадим только «личные» таблицы пользователя (его роли, заявку, профиль).
-- НЕ трогаем created_by/assigned_to/reviewed_by — там должно остаться SET NULL.

-- user_roles.user_id -> auth.users(id)
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'public.user_roles'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND (SELECT attname FROM pg_attribute WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'user_id'
  LIMIT 1;
  IF c IS NOT NULL THEN EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT ' || quote_ident(c); END IF;
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- access_requests.user_id -> auth.users(id)
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'public.access_requests'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND (SELECT attname FROM pg_attribute WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'user_id'
  LIMIT 1;
  IF c IS NOT NULL THEN EXECUTE 'ALTER TABLE public.access_requests DROP CONSTRAINT ' || quote_ident(c); END IF;
  ALTER TABLE public.access_requests
    ADD CONSTRAINT access_requests_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- user_profiles.id -> auth.users(id)
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'public.user_profiles'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND (SELECT attname FROM pg_attribute WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) = 'id'
  LIMIT 1;
  IF c IS NOT NULL THEN EXECUTE 'ALTER TABLE public.user_profiles DROP CONSTRAINT ' || quote_ident(c); END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';
