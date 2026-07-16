-- Фикс: создание ссылки-доступа к личному авто падало с 400.
-- CHECK был '^\d{4}$' (старый 4-значный код), а generateShareCode делает
-- 8-значный буквенно-цифровой код (алфавит без похожих символов) → нарушение.
-- Приводим констрейнт к реальному формату (4–16 буквенно-цифровых, покрывает и старые коды).
alter table public.vehicle_share_links drop constraint if exists vehicle_share_links_code_check;
alter table public.vehicle_share_links add constraint vehicle_share_links_code_check
  check (code ~ '^[A-Za-z0-9]{4,16}$');
