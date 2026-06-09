-- Самостоятельная выдача роли «user» (Личные автомобили) при регистрации.
-- Для личного использования подтверждение администратора не нужно — в отличие
-- от СТО/разборки. Функция SECURITY DEFINER: выдаёт ТОЛЬКО роль 'user' и только
-- если у пользователя ещё нет ролей, поэтому повысить себе права нельзя.

CREATE OR REPLACE FUNCTION public.claim_personal_user_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Гарантируем наличие профиля (строка могла не создаться триггером,
  -- напр. при входе через OAuth) — иначе FK на user_roles даст конфликт.
  INSERT INTO public.user_profiles (id, full_name, phone, username, email, real_email)
  SELECT u.id,
         COALESCE(u.raw_user_meta_data->>'full_name', ''),
         COALESCE(u.raw_user_meta_data->>'phone', ''),
         NULLIF(u.raw_user_meta_data->>'username', ''),
         u.email,
         COALESCE(u.raw_user_meta_data->>'real_email', u.email)
  FROM auth.users u
  WHERE u.id = uid
  ON CONFLICT (id) DO NOTHING;

  -- Если роли уже есть — ничего не делаем (нельзя выдать себе ничего сверх)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    RETURN;
  END IF;

  -- Выдаём роль 'user' как основную
  INSERT INTO public.user_roles (user_id, role_id, is_primary)
  SELECT uid, r.id, true
  FROM public.roles r
  WHERE r.name = 'user'
  LIMIT 1;

  -- Подчищаем возможную «висящую» заявку этого пользователя на личный доступ
  DELETE FROM public.access_requests
  WHERE user_id = uid AND request_type = 'user' AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_personal_user_role() TO authenticated;

NOTIFY pgrst, 'reload schema';
