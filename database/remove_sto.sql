-- ============================================================================
-- TSP V2 — удаление функционала СТО из базы данных (Supabase / Postgres)
-- ============================================================================
--
-- ⚠️  ПРИМЕНЯТЬ ВРУЧНУЮ В SUPABASE SQL EDITOR. НЕ запускается автоматически.
-- ⚠️  СНАЧАЛА СДЕЛАЙТЕ БЭКАП (Supabase → Database → Backups, либо pg_dump).
-- ⚠️  prod-схема может отличаться от репозитория (миграции применяются вручную).
--     Поэтому скрипт защищён `IF EXISTS`, но СВЕРЬТЕ имена таблиц с разделом
--     «ШАГ 0 — DISCOVERY» ниже перед выполнением блока DROP.
--
-- Контекст: СТО (автосервис) вынесен в отдельный проект. Здесь остаются
-- только Разборка (parts_*) и Мои авто (personal_vehicles). Фронтенд уже
-- очищен от СТО (ветка cleanup/remove-sto). Этот скрипт убирает СТО из БД.
--
-- Порядок применения:
--   1. ШАГ 0 — выполните отдельно, изучите что реально есть в вашей БД.
--   2. ШАГ 1 (обязательное) — удаление СТО-таблиц и СТО-строк/ролей.
--   3. ШАГ 2 (опциональное) — гибридные таблицы и столбцы. ПРОВЕРЬТЕ перед
--      выполнением: возможно, в них есть данные, которые нужно сохранить.
-- ============================================================================


-- ============================================================================
-- ШАГ 0 — DISCOVERY (выполнить ОТДЕЛЬНО, ничего не меняет)
-- Посмотрите, какие СТО-объекты реально существуют, прежде чем дропать.
-- ============================================================================

-- 0.1 Таблицы, похожие на СТО:
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN (
--      'appointments','appointment_comments','appointment_services','appointment_parts',
--      'work_orders','work_order_items','sto_invoices','invoices',
--      'services','service_categories','sto_employees','sto_companies','parts'
--    )
--  ORDER BY table_name;

-- 0.2 Триггеры/функции, ссылающиеся на appointments/work_orders (удалить вручную при наличии):
-- SELECT p.proname, n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE ANY (ARRAY['%appointments%','%work_orders%','%sto_company%']);

-- 0.3 Сколько СТО-строк в общих таблицах:
-- SELECT 'company_subscriptions sto' AS what, count(*) FROM company_subscriptions WHERE company_type = 'sto'
-- UNION ALL SELECT 'subscriptions sto', count(*) FROM subscriptions WHERE company_type = 'sto'
-- UNION ALL SELECT 'access_requests sto/store', count(*) FROM access_requests WHERE request_type IN ('sto_owner','sto_worker','store_owner','store_worker')
-- UNION ALL SELECT 'roles sto/store', count(*) FROM roles WHERE name IN ('sto_owner','sto_worker','store_owner','store_worker')
-- UNION ALL SELECT 'user_profiles with sto_company_id', count(*) FROM user_profiles WHERE sto_company_id IS NOT NULL;


-- ============================================================================
-- ШАГ 1 — ОБЯЗАТЕЛЬНОЕ: удаление чисто-СТО объектов
-- ============================================================================
BEGIN;

-- 1.1 — Дочерние СТО-таблицы (FK на appointments/work_orders/services).
DROP TABLE IF EXISTS appointment_parts      CASCADE;
DROP TABLE IF EXISTS appointment_services   CASCADE;
DROP TABLE IF EXISTS appointment_comments   CASCADE;
DROP TABLE IF EXISTS work_order_items       CASCADE;

-- 1.2 — Основные СТО-таблицы.
DROP TABLE IF EXISTS sto_invoices           CASCADE;
DROP TABLE IF EXISTS invoices               CASCADE;  -- legacy счета СТО
DROP TABLE IF EXISTS appointments           CASCADE;
DROP TABLE IF EXISTS work_orders            CASCADE;
DROP TABLE IF EXISTS services               CASCADE;
DROP TABLE IF EXISTS service_categories     CASCADE;
DROP TABLE IF EXISTS sto_employees          CASCADE;

-- 1.3 — Legacy-склад запчастей СТО (НЕ путать с parts_inventory!).
--       Раскомментируйте ТОЛЬКО если таблица `parts` относится к СТО, а не к разборке.
-- DROP TABLE IF EXISTS parts                CASCADE;

-- 1.4 — Компании СТО (после всех зависимых таблиц).
DROP TABLE IF EXISTS sto_companies          CASCADE;

-- 1.5 — Очистка СТО-строк в общих таблицах.
DELETE FROM company_subscriptions WHERE company_type = 'sto';
DELETE FROM subscriptions         WHERE company_type = 'sto';
DELETE FROM access_requests
  WHERE request_type IN ('sto_owner','sto_worker','store_owner','store_worker');

-- 1.6 — Удаление СТО/магазин ролей (сначала связи user_roles, потом сами роли).
DELETE FROM user_roles
  WHERE role_id IN (SELECT id FROM roles
                    WHERE name IN ('sto_owner','sto_worker','store_owner','store_worker'));
DELETE FROM roles
  WHERE name IN ('sto_owner','sto_worker','store_owner','store_worker');

COMMIT;


-- ============================================================================
-- ШАГ 2 — ОПЦИОНАЛЬНОЕ: гибридные таблицы и столбцы
-- ⚠️  ПРОВЕРЬТЕ перед выполнением. customers/vehicles в этом проекте
--     использовались только СТО (у разборки свои parts_customers/parts_vehicles),
--     но убедитесь, что там нет нужных данных. Столбцы sto_company_id безопасно
--     удалять — фронтенд их больше не читает.
-- ============================================================================
-- BEGIN;
--
-- -- 2.1 Гибридные таблицы (только если уверены, что это СТО-данные):
-- DROP TABLE IF EXISTS customers  CASCADE;
-- DROP TABLE IF EXISTS vehicles   CASCADE;
--
-- -- 2.2 Снятие СТО-столбцов с общих таблиц:
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS sto_company_id;
-- ALTER TABLE trash_bin     DROP COLUMN IF EXISTS sto_company_id;
--
-- COMMIT;


-- ============================================================================
-- ПОСЛЕ ВЫПОЛНЕНИЯ
-- ----------------------------------------------------------------------------
-- 1. Проверьте, что в Supabase больше нет СТО-таблиц (повторите ШАГ 0.1).
-- 2. Просмотрите RLS-политики и функции на остатки ссылок на удалённые таблицы
--    (ШАГ 0.2) — удалите их вручную при наличии.
-- 3. Edge Functions деплоятся вручную; СТО-специфичных среди них нет, менять не нужно.
-- ============================================================================
