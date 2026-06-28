-- Явное разделение «Разборка» vs «Магазин» для parts_inventory.
-- Раньше источник определялся по vehicle_id (null = магазин), из-за чего разборочная
-- запчасть без привязки к авто (напр. «Гайка колісна Tesla») ошибочно попадала в Магазин.
-- Теперь — явный флаг is_shop. Всё существующее = разборка (false). Магазин наполняется
-- отдельным меню добавления (позже), которое будет ставить is_shop=true.
alter table public.parts_inventory add column if not exists is_shop boolean not null default false;
create index if not exists idx_parts_inventory_is_shop on public.parts_inventory(parts_company_id, is_shop);
