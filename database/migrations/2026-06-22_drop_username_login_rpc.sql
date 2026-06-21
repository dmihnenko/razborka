-- CLEANUP: логин по username в проекте больше не используется (только email + Google OAuth).
-- RPC get_email_by_username (добавлялась как definer-замена прямого anon-чтения user_profiles
-- ради username-логина) больше не нужна и убирает лишнюю поверхность перебора username→email.
-- anon по-прежнему НЕ читает user_profiles напрямую (revoke остаётся в rls_user_profiles.sql).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

drop function if exists public.get_email_by_username(text);
