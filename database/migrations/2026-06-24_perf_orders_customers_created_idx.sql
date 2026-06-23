-- Перф (Этап 1): композитные индексы под основные списки кабинета.
-- getPartsOrders / getPartsCustomers фильтруют по parts_company_id и сортируют по created_at DESC,
-- но покрывающего составного индекса (company, created_at) не было — был только company-only.
-- Остальные горячие индексы (company_status, trgm-поиск, market-partial) уже существуют.

create index if not exists idx_parts_orders_company_created
  on public.parts_orders (parts_company_id, created_at desc);

create index if not exists idx_parts_customers_company_created
  on public.parts_customers (parts_company_id, created_at desc);
