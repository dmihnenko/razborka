-- Откат per-company курса (заменён глобальным курсом из app_settings, см. 2026-06-26_global_usd_rate.sql).
-- Колонки и RPC per-company курса больше не используются (модель стала глобальной read-only).
drop function if exists public.set_parts_usd_rate(numeric, text);
alter table public.parts_companies drop column if exists usd_rate;
alter table public.parts_companies drop column if exists usd_rate_date;
alter table public.parts_companies drop column if exists usd_rate_source;
