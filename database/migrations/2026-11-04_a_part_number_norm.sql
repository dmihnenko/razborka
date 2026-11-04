-- Поиск по OEM без учёта разделителей: «1K0 615 301 AA» находит «1K0615301AA».
-- part_number_norm = верхний регистр, кириллические двойники (А В Е К М Н О Р С Т Х) -> латиница,
-- всё кроме букв/цифр удалено. Правило обязано совпадать с src/utils/partNumberSearch.ts.
-- Идемпотентна. На больших таблицах добавление STORED-колонки переписывает таблицу — применять в окно низкой нагрузки.

alter table public.parts_inventory
  add column if not exists part_number_norm text
  generated always as (
    translate(
      upper(regexp_replace(coalesce(part_number, ''), '[^[:alnum:]]', '', 'g')),
      'АВЕКМНОРСТХ', 'ABEKMHOPCTX'
    )
  ) stored;

create index if not exists idx_parts_inventory_part_number_norm
  on public.parts_inventory (part_number_norm);

-- pg_trgm уже используется в репозитории (2026-06-13_cabinet_perf_indexes_dashboard_rpc.sql) -> trigram для ilike %...%
create extension if not exists pg_trgm;
create index if not exists idx_parts_inventory_part_number_norm_trgm
  on public.parts_inventory using gin (part_number_norm gin_trgm_ops);

-- Колонку во view market_inventory добавляет 2026-11-04_market_categories.sql: держим одно определение view.
