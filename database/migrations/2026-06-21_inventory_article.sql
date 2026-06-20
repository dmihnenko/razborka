-- Артикул (SKU) для позиций склада: короткий уникальный код, всегда есть
-- (товар может быть без OEM/серийника). Покупатель называет артикул — любой
-- сотрудник разборки находит позицию через поиск.
-- Применяется вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh).

create sequence if not exists public.parts_inventory_article_seq start 1000;

alter table public.parts_inventory add column if not exists article text;

-- Бэкфилл существующих позиций
update public.parts_inventory
   set article = nextval('public.parts_inventory_article_seq')::text
 where article is null;

-- Автогенерация для новых
alter table public.parts_inventory
  alter column article set default nextval('public.parts_inventory_article_seq')::text;

create unique index if not exists idx_parts_inventory_article on public.parts_inventory(article);
