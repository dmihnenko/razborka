-- Убран осиротевший «выполни любой SQL»-механизм (найдено QA 2026-07-02):
--  1) Edge Function `execute-sql` (verify_jwt=False, ACTIVE, исходника не было в репо,
--     фронтом/воркером не вызывалась) — УДАЛЕНА через Management API
--     (DELETE /v1/projects/hwckvddevjucuzxdoqqh/functions/execute-sql).
--  2) Парная БД-функция public.execute_sql(text) (SECURITY DEFINER, EXECUTE только
--     service_role/postgres — клиентам недостижима, но латентный footgun) — не
--     ссылается ниоткуда, дропаем.
-- Управление БД идёт напрямую через Management API (как postgres/service_role),
-- эта функция не нужна.
drop function if exists public.execute_sql(text);
