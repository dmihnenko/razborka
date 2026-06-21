-- Per-company хранилище фото: каждый владелец разборки активирует СВОЁ хранилище.
-- provider — выбранный сервис (imgbb | cloudinary | freeimage), config — ключи/пресеты.
-- Читают/пишут члены компании (RLS на parts_companies уже это ограничивает).
-- Ключи здесь — write-ключи бесплатных аккаунтов владельца / публичные пресеты,
-- клиент всё равно использует их при загрузке.
alter table public.parts_companies
  add column if not exists photo_provider text not null default 'imgbb',
  add column if not exists photo_config  jsonb not null default '{}'::jsonb;

comment on column public.parts_companies.photo_provider is 'Сервис хранения фото: imgbb | cloudinary | freeimage';
comment on column public.parts_companies.photo_config  is 'Конфиг провайдера: { imgbb:{key}, cloudinary:{cloudName,preset}, freeimage:{key} }';
