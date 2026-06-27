-- Фиче-флаги: админ включает/выключает опции маркета «ползунком». Флаги публичные
-- (гейтят UI у всех, включая анонимов), менять может только админ.
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  label text,
  updated_at timestamptz default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists ff_select on public.feature_flags;
create policy ff_select on public.feature_flags for select using (true);

drop policy if exists ff_update on public.feature_flags;
create policy ff_update on public.feature_flags for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists ff_insert on public.feature_flags;
create policy ff_insert on public.feature_flags for insert to authenticated
  with check (public.is_admin());

grant select on public.feature_flags to anon, authenticated;

-- Сид: реализованное включено, заготовки выключены (админ включит, когда готовы)
insert into public.feature_flags(key, enabled, label) values
  ('market_price_filter', true,  'Фильтр по цене в каталоге'),
  ('market_reviews',      false, 'Отзывы и рейтинг разборок'),
  ('market_favorites',    false, 'Избранное в маркете')
on conflict (key) do nothing;
