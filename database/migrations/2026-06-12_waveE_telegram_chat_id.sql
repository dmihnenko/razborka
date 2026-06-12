-- Волна E: привязка разборки к Telegram-чату для уведомлений.
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-12.
-- chat_id заполняется ботом при переходе по ссылке t.me/<bot>?start=<company_id>.

alter table public.parts_companies add column if not exists telegram_chat_id text;
