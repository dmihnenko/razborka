-- Убираем устаревшие 2-арг перегрузки RPC (найдено QA 2026-07-02): при вызове с 2
-- аргументами PostgREST не мог выбрать между старой (uuid,numeric) и новой
-- (uuid,numeric,text/boolean) версией → 300 PGRST203. Фронт всегда шлёт 3-й аргумент
-- (p_period / p_is_shop), поэтому в проде 200, но 2-арг версии — мёртвый код и латентный
-- риск. Оставляем только актуальные 3-арг версии.
drop function if exists public.get_parts_dashboard_stats(uuid, numeric);
drop function if exists public.get_parts_inventory_summary(uuid, numeric);
