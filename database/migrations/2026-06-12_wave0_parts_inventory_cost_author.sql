-- Волна 0 (баг-долг разборки): закупочная цена и автор позиции склада.
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-12.
--
-- purchase_price — для метрик окупаемости (ROI): раньше поле срезалось в
--   partsService.create/updatePartsInventoryItem, т.к. колонки не было.
-- created_by — для KPI «кто завёл позицию»; дефолт auth.uid() проставляет автора
--   на вставке без правок приложения.

alter table public.parts_inventory add column if not exists purchase_price numeric;
alter table public.parts_inventory add column if not exists created_by uuid default auth.uid();
