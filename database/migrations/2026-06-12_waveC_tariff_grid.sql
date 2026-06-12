-- Волна C: тарифная сетка из роадмапа (переименование + новые лимиты).
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-12.
-- На момент применения на Пакет 1/2/3 не было ни одного активного подписчика — смена безопасна.
--
-- Пакет 1 → Старт   (400 ₴): 300 запч · 3 авто · 2 сотр · без аналитики
-- Пакет 2 → Бизнес  (600 ₴): 1500 запч · 10 авто · 4 сотр · без аналитики
-- Пакет 3 → Профи   (800 ₴): 5000 запч · 30 авто · 8 сотр · аналитика + ROI
-- Демо-доступ              : 50 запч · 3 авто · 2 сотр · без аналитики (раньше null=безлимит)
--
-- ВАЖНО: имена кириллицей — Management API ДОЛЖЕН слать тело как UTF-8 байты
-- (иначе PowerShell превращает кириллицу в «?»). Проверка: octet_length('Старт')=10.

begin;

update public.subscriptions set
  name='Старт',
  description='300 запчастей · 3 авто · 2 сотрудника',
  max_parts=300, max_vehicles=3, max_workers=2, has_analytics=false, sort_order=1
where id='3b620646-0fd1-41fc-8eb0-cd383957cb20';

update public.subscriptions set
  name='Бизнес',
  description='1500 запчастей · 10 авто · 4 сотрудника',
  max_parts=1500, max_vehicles=10, max_workers=4, has_analytics=false, sort_order=2
where id='5a9096fa-5559-41b2-b2ff-8f91a24b5e33';

update public.subscriptions set
  name='Профи',
  description='5000 запчастей · 30 авто · 8 сотрудников · аналитика и окупаемость',
  max_parts=5000, max_vehicles=30, max_workers=8, has_analytics=true, sort_order=3
where id='d278e59e-1465-4fa6-be07-83ad2fb65dd5';

-- Демо-гейт: ограничиваем демо-доступ (companies на нём имели null=безлимит)
update public.subscriptions set
  max_parts=50, max_vehicles=3, max_workers=2, has_analytics=false
where id='6d63c3c1-7cda-4379-8035-48893eb34a45';

commit;
