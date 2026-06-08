-- Контакт Telegram для разборки (показывается на публичной странице запчасти,
-- чтобы покупатели могли написать продавцу в Telegram).
-- Разборщик задаёт его в Настройках разборки.

alter table public.parts_companies
  add column if not exists telegram text;
