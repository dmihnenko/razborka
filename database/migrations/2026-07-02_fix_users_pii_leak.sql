-- 🔴 (найдено QA 2026-07-02) PII-утечка: легаси-таблица public.users была открыта
-- анониму — политика "Allow anon users" (SELECT USING(true) для роли public) + anon
-- column-grants → аноним читал email/phone/full_name ВСЕХ пользователей (перечисление
-- для фишинга/credential-stuffing). Таблица легаси: приложение работает через
-- user_profiles, FK на public.users нет, фронт таблицу не читает.
-- Фикс: снять permissive-политики + отозвать anon-гранты. Остаются корректные
-- own/admin-политики и authenticated-insert при signup.
drop policy if exists "Allow anon users" on public.users;
drop policy if exists "Allow anon insert" on public.users;
revoke select, insert on public.users from anon;
