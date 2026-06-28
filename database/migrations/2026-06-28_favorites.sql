-- Избранное в маркете (под фиче-флагом market_favorites). Привязано к юзеру.
create table if not exists public.market_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.parts_inventory(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, inventory_id)
);
alter table public.market_favorites enable row level security;
drop policy if exists mf_all on public.market_favorites;
create policy mf_all on public.market_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.market_favorites to authenticated;
