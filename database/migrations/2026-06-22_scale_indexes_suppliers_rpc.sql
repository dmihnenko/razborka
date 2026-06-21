-- ОПТИМИЗАЦИЯ ПОД МАСШТАБ (≈100 разборок × 10k+ запчастей ≈ 1M+ строк).
-- P0: индексы под реальные запросы + RPC для списка разборок (убираем N+1).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).
-- NB: на УЖЕ большой таблице создавать индексы лучше по одному с CONCURRENTLY
--     (вне транзакции). На текущем объёме (≈150 строк) обычный CREATE INDEX мгновенный.

-- 1) Склад: запросы по storage_location_id (.in(...), .not(... is null)) при 10k+ → seq scan.
create index if not exists idx_pi_storage_loc
  on public.parts_inventory (storage_location_id)
  where storage_location_id is not null;

-- 2) Витрина маркета (анонимы): фильтр status='available' AND selling_price>0,
--    сортировки created_at DESC / selling_price. Частичные индексы под видимый набор.
create index if not exists idx_pi_market_new
  on public.parts_inventory (created_at desc)
  where status = 'available' and selling_price > 0;

create index if not exists idx_pi_market_price
  on public.parts_inventory (selling_price)
  where status = 'available' and selling_price > 0;

-- 3) Счётчик доступных позиций по разборке (RPC разборок, getRelatedParts).
create index if not exists idx_pi_company_market
  on public.parts_inventory (parts_company_id)
  where status = 'available' and selling_price > 0;

-- 4) Поиск по артикулу: article.ilike('%x%') — unique btree не годится для contains.
create index if not exists idx_pi_article_trgm
  on public.parts_inventory using gin (article gin_trgm_ops);

-- 5) Поиск маркета ORs по description — без индекса ломает индексный план всего OR.
create index if not exists idx_pi_description_trgm
  on public.parts_inventory using gin (description gin_trgm_ops);

-- 6) Список разборок одним запросом (было: 1 + N count-запросов на компанию).
create or replace function public.get_market_suppliers()
returns table (
  id uuid, name text, phone text, telegram text, address text,
  city text, email text, description text, available_parts bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name::text, c.phone::text, c.telegram, c.address,
         c.city, c.email::text, c.description,
         coalesce(cnt.n, 0) as available_parts
  from public.parts_companies c
  left join (
    select parts_company_id, count(*)::bigint as n
    from public.parts_inventory
    where status = 'available' and selling_price > 0
    group by parts_company_id
  ) cnt on cnt.parts_company_id = c.id
  where c.is_active and c.market_published
  order by c.name;
$$;

grant execute on function public.get_market_suppliers() to anon, authenticated;
