-- Бэкфилл: язык интерфейса (user_profiles.locale) -> auth.users.raw_user_meta_data.locale
-- Нужно, чтобы письма Supabase Auth (сброс пароля) приходили на ОДНОМ языке пользователя
-- через условный шаблон {{ if eq .Data.locale "uk" }}…{{ else }}…{{ end }} (.Data = raw_user_meta_data).
-- Новые/последующие изменения языка синхронизирует фронт (userService.updateUserLocale ->
-- supabase.auth.updateUser({ data: { locale } })). Это разовый бэкфилл существующих.
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                         || jsonb_build_object('locale', p.locale)
FROM public.user_profiles p
WHERE p.id = u.id
  AND p.locale IS NOT NULL
  AND p.locale <> ''
  AND coalesce(u.raw_user_meta_data->>'locale', '') <> p.locale;
