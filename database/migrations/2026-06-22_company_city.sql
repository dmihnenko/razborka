-- Город разборки — для фильтра разборок по городу в маркете.
-- Заполняется владельцем в настройках; покупатель фильтрует список «Разборки».
-- Применяется через Supabase Management API (ref hwckvddevjucuzxdoqqh).

alter table public.parts_companies
  add column if not exists city text;
