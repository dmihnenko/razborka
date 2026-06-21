-- SECURITY (КРИТИЧНО): роль anon (публичный ключ зашит во фронте) имела
-- INSERT/UPDATE/DELETE/TRUNCATE на ВСЕХ таблицах public → аноним мог затирать/удалять
-- любые данные (TRUNCATE игнорирует RLS) и эскалировать права через user_roles.
-- anon должен быть READ-ONLY; все публичные записи идут через SECURITY DEFINER RPC
-- (submit_marketplace_order). Прямых anon-записей в коде нет (проверено).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- Чтобы будущие таблицы не наследовали право записи для anon.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
