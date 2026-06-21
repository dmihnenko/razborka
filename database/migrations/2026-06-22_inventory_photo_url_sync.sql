-- P2: photo_url для лёгких списков каталога.
-- Публичный каталог тянул в каждую из 24 карточек/стр полный photos jsonb, хотя
-- карточке нужна одна тумба. photo_url пуст у всех строк → заполняем из photos[0]
-- и держим в синке триггером; каталог затем выбирает только photo_url (без photos).
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

-- 1) Бэкфилл из первого фото.
update public.parts_inventory
set photo_url = coalesce(
  photos->0->>'thumb_url', photos->0->>'display_url',
  photos->0->>'url', photos->0->>'medium_url'
)
where photo_url is null
  and photos is not null
  and jsonb_typeof(photos) = 'array'
  and jsonb_array_length(photos) > 0;

-- 2) Синк photo_url ← photos[0] при вставке/смене фото.
create or replace function public.sync_parts_inventory_photo_url()
returns trigger
language plpgsql
as $$
begin
  new.photo_url := coalesce(
    new.photos->0->>'thumb_url', new.photos->0->>'display_url',
    new.photos->0->>'url', new.photos->0->>'medium_url'
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_photo_url on public.parts_inventory;
create trigger trg_sync_photo_url
  before insert or update of photos on public.parts_inventory
  for each row execute function public.sync_parts_inventory_photo_url();
