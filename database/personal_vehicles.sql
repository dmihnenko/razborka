-- Создаем таблицу личных автомобилей пользователей
create table if not exists personal_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  make_model text not null check (char_length(make_model) >= 3 and char_length(make_model) <= 100),
  year integer not null check (year >= 1900 and year <= 2027),
  vin text check (char_length(vin) = 17 or vin is null),
  photo_url text,
  usd_rate numeric(10,2) check (usd_rate > 0 or usd_rate is null),
  
  -- Расходы по категориям (JSONB массивы объектов PersonalCostItem)
  lot_items jsonb default '[]'::jsonb not null,
  parts_items jsonb default '[]'::jsonb not null,
  work_items jsonb default '[]'::jsonb not null,
  additional_items jsonb default '[]'::jsonb not null,
  
  -- Общая стоимость в USD
  total_cost numeric(12,2) default 0 not null,
  
  -- Продажа
  is_sold boolean default false not null,
  sold_at timestamptz,
  sale_price numeric(12,2) check (sale_price >= 0 or sale_price is null),
  
  -- Фото альбомы (JSONB массивы объектов {url, uploadedAt, fileName})
  usa_photos jsonb default '[]'::jsonb not null,
  port_photos jsonb default '[]'::jsonb not null,
  arrival_photos jsonb default '[]'::jsonb not null,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Создаем таблицу кодов доступа к автомобилям
create table if not exists vehicle_share_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^\d{4}$'),
  vehicle_id uuid references personal_vehicles(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz,
  is_active boolean default true not null
);

-- Индексы для производительности
create index if not exists idx_personal_vehicles_user_id on personal_vehicles(user_id);
create index if not exists idx_personal_vehicles_is_sold on personal_vehicles(is_sold);
create index if not exists idx_vehicle_share_links_code on vehicle_share_links(code) where is_active = true;
create index if not exists idx_vehicle_share_links_vehicle_id on vehicle_share_links(vehicle_id);

-- Функция для автоматического обновления updated_at
create or replace function update_personal_vehicle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Триггер для updated_at
drop trigger if exists trigger_update_personal_vehicle_updated_at on personal_vehicles;
create trigger trigger_update_personal_vehicle_updated_at
  before update on personal_vehicles
  for each row
  execute function update_personal_vehicle_updated_at();

-- RLS политики для personal_vehicles
alter table personal_vehicles enable row level security;

-- Удаляем старые политики если существуют
drop policy if exists "Users can view own vehicles or via share code" on personal_vehicles;
drop policy if exists "Users can create own vehicles" on personal_vehicles;
drop policy if exists "Users can update own vehicles" on personal_vehicles;
drop policy if exists "Users can delete own vehicles" on personal_vehicles;

-- Пользователи видят свои автомобили ИЛИ автомобили по активному коду доступа (публичный просмотр)
create policy "Users can view own vehicles or via share code"
  on personal_vehicles for select
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from vehicle_share_links
      where vehicle_share_links.vehicle_id = personal_vehicles.id
        and vehicle_share_links.is_active = true
        and (vehicle_share_links.expires_at is null or vehicle_share_links.expires_at > now())
    )
  );

-- Пользователи могут создавать автомобили только для себя (требуется авторизация)
create policy "Users can create own vehicles"
  on personal_vehicles for insert
  with check (auth.uid() = user_id and auth.uid() is not null);

-- Пользователи могут обновлять только свои автомобили
create policy "Users can update own vehicles"
  on personal_vehicles for update
  using (auth.uid() = user_id);

-- Пользователи могут удалять только свои автомобили
create policy "Users can delete own vehicles"
  on personal_vehicles for delete
  using (auth.uid() = user_id);

-- RLS политики для vehicle_share_links
alter table vehicle_share_links enable row level security;

-- Удаляем старые политики если существуют
drop policy if exists "Anyone can read active share links" on vehicle_share_links;
drop policy if exists "Users can create share links for own vehicles" on vehicle_share_links;
drop policy if exists "Users can update own share links" on vehicle_share_links;
drop policy if exists "Users can delete own share links" on vehicle_share_links;

-- Все могут читать активные коды (для публичной валидации без авторизации)
create policy "Anyone can read active share links"
  on vehicle_share_links for select
  using (is_active = true);

-- Только владельцы автомобилей могут создавать коды (требуется авторизация)
create policy "Users can create share links for own vehicles"
  on vehicle_share_links for insert
  with check (
    auth.uid() = user_id and
    auth.uid() is not null and
    exists (
      select 1 from personal_vehicles
      where id = vehicle_id and user_id = auth.uid()
    )
  );

-- Пользователи могут обновлять только свои коды
create policy "Users can update own share links"
  on vehicle_share_links for update
  using (auth.uid() = user_id);

-- Пользователи могут удалять только свои коды
create policy "Users can delete own share links"
  on vehicle_share_links for delete
  using (auth.uid() = user_id);
