-- Тариф «Склад» для крупных разборок + описания тарифов по реальным лимитам. Идемпотентна.
insert into public.subscriptions
  (name, type, price, description, is_active, company_type, max_workers, duration_months, sort_order,
   is_custom, max_vehicles, max_parts, has_analytics, is_demo, max_photo_storage_mb, max_photos)
select 'Склад', 'monthly', 1200, '', true, 'parts', 8, 1, 4, false, 15, 3000, true, false, 1500, 5000
where not exists (select 1 from public.subscriptions where name = 'Склад' and company_type = 'parts');

-- Индивидуальный план (Премиум) — после «Склада»
update public.subscriptions set sort_order = 5 where name = 'Премиум' and company_type = 'parts';

-- Короткие описания «для кого тариф»: лимиты и так перечислены в карточке списком
-- (раньше описания расходились с лимитами: Профи «5000 запчастей», а лимит 1200)
update public.subscriptions set description = 'Попробовать бесплатно'               where company_type = 'parts' and name = 'Демо';
update public.subscriptions set description = 'Для небольшой разборки'              where company_type = 'parts' and name = 'Старт';
update public.subscriptions set description = 'Для растущей разборки'               where company_type = 'parts' and name = 'Бизнес';
update public.subscriptions set description = 'Для активной разборки, с аналитикой' where company_type = 'parts' and name = 'Профи';
update public.subscriptions set description = 'Для крупного склада запчастей'       where company_type = 'parts' and name = 'Склад';
update public.subscriptions set description = 'Индивидуальные лимиты по запросу'    where company_type = 'parts' and name = 'Премиум';
