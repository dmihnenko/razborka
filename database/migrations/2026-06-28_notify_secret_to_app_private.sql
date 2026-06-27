-- БЕЗОПАСНОСТЬ (P0): вынос internal-секрета telegram-bot из тела функций в app_private.
--
-- Раньше функции notify_parts_order_shipped и submit_marketplace_order содержали
-- секрет NOTIFY_SECRET ЛИТЕРАЛОМ в коде (он же попал в git-историю миграций) и слали
-- его заголовком 'x-internal-secret' в Edge Function telegram-bot. Секрет считается
-- скомпрометированным и РОТИРОВАН (новое значение задано в Edge env NOTIFY_SECRET и в
-- app_private.notify_secret). Функции теперь читают секрет из приватной таблицы.
--
-- app_private — таблица с RLS без политик (недоступна anon/authenticated), читается
-- только SECURITY DEFINER-функциями. Тот же паттерн, что у cron_rate_secret.

-- 1) Ключ в приватном хранилище (значение задаётся вручную через Management API/панель,
--    здесь — плейсхолдер, чтобы свежая БД не падала; в проде значение уже выставлено).
insert into public.app_private(key, value)
values ('notify_secret', '__SET_VIA_DASHBOARD__')
on conflict (key) do nothing;

-- 2) Функции notify_parts_order_shipped и submit_marketplace_order пересозданы так, что
--    вместо литерала используют: (select value from public.app_private where key='notify_secret').
--    Их актуальные определения — в соответствующих (вычищенных от литерала) миграциях
--    2026-06-21_market_order_telegram*.sql и 2026-06-26_client_orders.sql. В проде
--    пересозданы напрямую через Management API 2026-06-28.
