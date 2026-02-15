-- CRM - Схема базы данных Supabase

-- Включаем расширение для UUID
create extension if not exists "uuid-ossp";

-- Таблица ролей пользователей
create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique,
  display_name text not null,
  description text,
  permissions jsonb default '{}'::jsonb,
  is_active boolean default true
);

-- Таблица профилей пользователей (расширяет auth.users)
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  phone text,
  avatar_url text,
  role_id uuid references roles(id) on delete set null,
  is_active boolean default true,
  last_login timestamp with time zone
);

-- Таблица категорий услуг
create table if not exists service_categories (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique,
  description text,
  color text default '#3B82F6',
  icon text,
  sort_order integer default 0
);

-- Таблица клиентов
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  phone text not null,
  email text,
  address text,
  notes text
);

-- Таблица автомобилей
create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references customers(id) on delete cascade not null,
  brand text not null,
  model text not null,
  year integer not null,
  vin text,
  license_plate text not null,
  color text,
  mileage integer
);

-- Таблица услуг
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  duration_minutes integer,
  category_id uuid references service_categories(id) on delete set null
);

-- Таблица запчастей
create table if not exists parts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  part_number text unique,
  description text,
  quantity_in_stock integer default 0 not null,
  min_quantity integer default 0 not null,
  price numeric(10, 2) not null,
  supplier text
);

-- Добавляем UNIQUE constraint на part_number если его нет
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'parts_part_number_key' 
    and conrelid = 'parts'::regclass
  ) then
    alter table parts add constraint parts_part_number_key unique (part_number);
  end if;
exception
  when others then null;
end $$;

-- Таблица записей на обслуживание
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references customers(id) on delete cascade not null,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  scheduled_date timestamp with time zone not null,
  status text check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')) default 'scheduled' not null,
  notes text
);

-- Таблица заказ-нарядов
create table if not exists work_orders (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  appointment_id uuid references appointments(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  status text check (status in ('draft', 'in_progress', 'completed', 'invoiced')) default 'draft' not null,
  total_cost numeric(10, 2) default 0 not null,
  start_date timestamp with time zone,
  completion_date timestamp with time zone,
  notes text
);

-- Таблица позиций заказ-наряда
create table if not exists work_order_items (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  work_order_id uuid references work_orders(id) on delete cascade not null,
  service_id uuid references services(id) on delete set null,
  part_id uuid references parts(id) on delete set null,
  description text not null,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null
);

-- Таблица счетов
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  work_order_id uuid references work_orders(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  invoice_number text unique not null,
  issue_date date not null,
  due_date date not null,
  total_amount numeric(10, 2) not null,
  paid_amount numeric(10, 2) default 0 not null,
  status text check (status in ('pending', 'paid', 'overdue', 'cancelled')) default 'pending' not null,
  payment_method text,
  notes text
);

-- Добавляем category_id в services если её нет (для существующих баз)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'services' and column_name = 'category_id'
  ) then
    alter table services add column category_id uuid references service_categories(id) on delete set null;
  end if;
end $$;

-- Создаем индексы для оптимизации запросов
create index if not exists idx_user_profiles_role_id on user_profiles(role_id);
create index if not exists idx_services_category_id on services(category_id);
create index if not exists idx_vehicles_customer_id on vehicles(customer_id);
create index if not exists idx_appointments_customer_id on appointments(customer_id);
create index if not exists idx_appointments_vehicle_id on appointments(vehicle_id);
create index if not exists idx_appointments_scheduled_date on appointments(scheduled_date);
create index if not exists idx_work_orders_customer_id on work_orders(customer_id);
create index if not exists idx_work_orders_vehicle_id on work_orders(vehicle_id);
create index if not exists idx_work_order_items_work_order_id on work_order_items(work_order_id);
create index if not exists idx_invoices_customer_id on invoices(customer_id);
create index if not exists idx_invoices_work_order_id on invoices(work_order_id);

-- Включаем Row Level Security (RLS)
alter table roles enable row level security;
alter table user_profiles enable row level security;
alter table service_categories enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table services enable row level security;
alter table parts enable row level security;
alter table appointments enable row level security;
alter table work_orders enable row level security;
alter table work_order_items enable row level security;
alter table invoices enable row level security;

-- Создаем политики доступа с учетом ролей

-- Roles - только админы могут управлять ролями
drop policy if exists "Allow all authenticated users to read roles" on roles;
create policy "Allow all authenticated users to read roles"
  on roles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow admins to manage roles" on roles;
create policy "Allow admins to manage roles"
  on roles for all
  using (
    exists (
      select 1 from user_profiles up
      join roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'admin'
    )
  );

-- User Profiles - пользователи могут читать свой профиль и обновлять его
drop policy if exists "Users can view all profiles" on user_profiles;
create policy "Users can view all profiles"
  on user_profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can update own profile" on user_profiles;
create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = id);

drop policy if exists "Allow admins to manage user profiles" on user_profiles;
create policy "Allow admins to manage user profiles"
  on user_profiles for all
  using (
    exists (
      select 1 from user_profiles up
      join roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'admin'
    )
  );

-- Service Categories
drop policy if exists "Allow authenticated users to read service_categories" on service_categories;
create policy "Allow authenticated users to read service_categories"
  on service_categories for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert service_categories" on service_categories;
create policy "Allow authenticated users to insert service_categories"
  on service_categories for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update service_categories" on service_categories;
create policy "Allow authenticated users to update service_categories"
  on service_categories for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete service_categories" on service_categories;
create policy "Allow authenticated users to delete service_categories"
  on service_categories for delete
  using (auth.role() = 'authenticated');

-- В реальном проекте нужно настроить более строгие политики

-- Customers
drop policy if exists "Allow authenticated users to read customers" on customers;
create policy "Allow authenticated users to read customers"
  on customers for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert customers" on customers;
create policy "Allow authenticated users to insert customers"
  on customers for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update customers" on customers;
create policy "Allow authenticated users to update customers"
  on customers for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete customers" on customers;
create policy "Allow authenticated users to delete customers"
  on customers for delete
  using (auth.role() = 'authenticated');

-- Vehicles
drop policy if exists "Allow authenticated users to read vehicles" on vehicles;
create policy "Allow authenticated users to read vehicles"
  on vehicles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert vehicles" on vehicles;
create policy "Allow authenticated users to insert vehicles"
  on vehicles for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update vehicles" on vehicles;
create policy "Allow authenticated users to update vehicles"
  on vehicles for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete vehicles" on vehicles;
create policy "Allow authenticated users to delete vehicles"
  on vehicles for delete
  using (auth.role() = 'authenticated');

-- Services
drop policy if exists "Allow authenticated users to read services" on services;
create policy "Allow authenticated users to read services"
  on services for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert services" on services;
create policy "Allow authenticated users to insert services"
  on services for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update services" on services;
create policy "Allow authenticated users to update services"
  on services for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete services" on services;
create policy "Allow authenticated users to delete services"
  on services for delete
  using (auth.role() = 'authenticated');

-- Parts
drop policy if exists "Allow authenticated users to read parts" on parts;
create policy "Allow authenticated users to read parts"
  on parts for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert parts" on parts;
create policy "Allow authenticated users to insert parts"
  on parts for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update parts" on parts;
create policy "Allow authenticated users to update parts"
  on parts for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete parts" on parts;
create policy "Allow authenticated users to delete parts"
  on parts for delete
  using (auth.role() = 'authenticated');

-- Appointments
drop policy if exists "Allow authenticated users to read appointments" on appointments;
create policy "Allow authenticated users to read appointments"
  on appointments for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert appointments" on appointments;
create policy "Allow authenticated users to insert appointments"
  on appointments for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update appointments" on appointments;
create policy "Allow authenticated users to update appointments"
  on appointments for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete appointments" on appointments;
create policy "Allow authenticated users to delete appointments"
  on appointments for delete
  using (auth.role() = 'authenticated');

-- Work Orders
drop policy if exists "Allow authenticated users to read work_orders" on work_orders;
create policy "Allow authenticated users to read work_orders"
  on work_orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert work_orders" on work_orders;
create policy "Allow authenticated users to insert work_orders"
  on work_orders for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update work_orders" on work_orders;
create policy "Allow authenticated users to update work_orders"
  on work_orders for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete work_orders" on work_orders;
create policy "Allow authenticated users to delete work_orders"
  on work_orders for delete
  using (auth.role() = 'authenticated');

-- Work Order Items
drop policy if exists "Allow authenticated users to read work_order_items" on work_order_items;
create policy "Allow authenticated users to read work_order_items"
  on work_order_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert work_order_items" on work_order_items;
create policy "Allow authenticated users to insert work_order_items"
  on work_order_items for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update work_order_items" on work_order_items;
create policy "Allow authenticated users to update work_order_items"
  on work_order_items for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete work_order_items" on work_order_items;
create policy "Allow authenticated users to delete work_order_items"
  on work_order_items for delete
  using (auth.role() = 'authenticated');

-- Invoices
drop policy if exists "Allow authenticated users to read invoices" on invoices;
create policy "Allow authenticated users to read invoices"
  on invoices for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to insert invoices" on invoices;
create policy "Allow authenticated users to insert invoices"
  on invoices for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to update invoices" on invoices;
create policy "Allow authenticated users to update invoices"
  on invoices for update
  using (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated users to delete invoices" on invoices;
create policy "Allow authenticated users to delete invoices"
  on invoices for delete
  using (auth.role() = 'authenticated');

-- Функция для автоматического обновления total_cost в work_orders
create or replace function update_work_order_total()
returns trigger as $$
begin
  update work_orders
  set total_cost = (
    select coalesce(sum(total_price), 0)
    from work_order_items
    where work_order_id = NEW.work_order_id
  )
  where id = NEW.work_order_id;
  return NEW;
end;
$$ language plpgsql;

-- Триггер для обновления total_cost
drop trigger if exists update_work_order_total_trigger on work_order_items;
create trigger update_work_order_total_trigger
after insert or update or delete on work_order_items
for each row execute function update_work_order_total();

-- Вставим несколько примеров данных для тестирования

-- Роли пользователей
insert into roles (name, display_name, description, permissions) values
  ('admin', 'Администратор', 'Полный доступ ко всем функциям системы', '{"all": true}'::jsonb),
  ('user', 'Пользователь', 'Базовый уровень доступа', '{"read": true}'::jsonb),
  ('sto_owner', 'Владелец СТО', 'Владелец станции технического обслуживания', '{"sto": {"manage": true, "reports": true, "staff": true}}'::jsonb),
  ('sto_worker', 'Работник СТО', 'Сотрудник станции технического обслуживания', '{"sto": {"work_orders": true, "customers": true, "vehicles": true}}'::jsonb),
  ('parts_owner', 'Владелец разборки', 'Владелец авторазборки (будущий функционал)', '{"parts_shop": {"manage": true, "reports": true, "staff": true}}'::jsonb),
  ('parts_worker', 'Работник разборки', 'Сотрудник авторазборки (будущий функционал)', '{"parts_shop": {"inventory": true, "sales": true}}'::jsonb),
  ('store_owner', 'Владелец автомагазина', 'Владелец автомагазина (будущий функционал)', '{"auto_store": {"manage": true, "reports": true, "staff": true}}'::jsonb),
  ('store_worker', 'Работник автомагазина', 'Сотрудник автомагазина (будущий функционал)', '{"auto_store": {"inventory": true, "sales": true}}'::jsonb)
on conflict (name) do nothing;

-- Категории услуг
insert into service_categories (name, description, color, sort_order) values
  ('Техническое обслуживание', 'Плановое ТО и регламентные работы', '#10B981', 1),
  ('Диагностика', 'Компьютерная и визуальная диагностика', '#3B82F6', 2),
  ('Ремонт двигателя', 'Ремонт и обслуживание двигателя', '#EF4444', 3),
  ('Ходовая часть', 'Ремонт подвески и рулевого управления', '#F59E0B', 4),
  ('Тормозная система', 'Ремонт и обслуживание тормозов', '#DC2626', 5),
  ('Электрика', 'Электрооборудование и электроника', '#8B5CF6', 6),
  ('Кузовные работы', 'Кузовной ремонт и покраска', '#EC4899', 7),
  ('Шиномонтаж', 'Шиномонтаж и балансировка', '#14B8A6', 8),
  ('Замена жидкостей', 'Замена масел и технических жидкостей', '#06B6D4', 9),
  ('Регулировки', 'Регулировочные и настроечные работы', '#6366F1', 10)
on conflict (name) do nothing;

-- Услуги с категориями
do $$
declare
  cat_id uuid;
begin
  -- Замена масла
  select id into cat_id from service_categories where name = 'Замена жидкостей' limit 1;
  if cat_id is not null and not exists (select 1 from services where name = 'Замена масла') then
    insert into services (name, description, price, duration_minutes, category_id) 
    values ('Замена масла', 'Замена моторного масла и масляного фильтра', 1500, 30, cat_id);
  end if;

  -- Диагностика двигателя
  select id into cat_id from service_categories where name = 'Диагностика' limit 1;
  if cat_id is not null and not exists (select 1 from services where name = 'Диагностика двигателя') then
    insert into services (name, description, price, duration_minutes, category_id) 
    values ('Диагностика двигателя', 'Компьютерная диагностика неисправностей двигателя', 1000, 45, cat_id);
  end if;

  -- Замена тормозных колодок
  select id into cat_id from service_categories where name = 'Тормозная система' limit 1;
  if cat_id is not null and not exists (select 1 from services where name = 'Замена тормозных колодок') then
    insert into services (name, description, price, duration_minutes, category_id) 
    values ('Замена тормозных колодок', 'Замена передних тормозных колодок', 3000, 60, cat_id);
  end if;

  -- Развал-схождение
  select id into cat_id from service_categories where name = 'Регулировки' limit 1;
  if cat_id is not null and not exists (select 1 from services where name = 'Развал-схождение') then
    insert into services (name, description, price, duration_minutes, category_id) 
    values ('Развал-схождение', 'Регулировка углов установки колес', 2000, 40, cat_id);
  end if;

  -- Замена свечей зажигания
  select id into cat_id from service_categories where name = 'Техническое обслуживание' limit 1;
  if cat_id is not null and not exists (select 1 from services where name = 'Замена свечей зажигания') then
    insert into services (name, description, price, duration_minutes, category_id) 
    values ('Замена свечей зажигания', 'Замена комплекта свечей зажигания', 800, 20, cat_id);
  end if;
end $$;

-- Запчасти
insert into parts (name, part_number, description, quantity_in_stock, min_quantity, price, supplier) values
  ('Моторное масло 5W-40', 'OIL-5W40-4L', 'Синтетическое моторное масло 4л', 25, 10, 1200, 'Shell'),
  ('Масляный фильтр', 'FILTER-OIL-001', 'Масляный фильтр стандарт', 30, 15, 250, 'Mann'),
  ('Тормозные колодки передние', 'BRAKE-FRONT-001', 'Комплект передних тормозных колодок', 10, 5, 2500, 'Brembo'),
  ('Свечи зажигания', 'SPARK-001', 'Комплект свечей зажигания (4 шт)', 20, 8, 800, 'NGK'),
  ('Воздушный фильтр', 'FILTER-AIR-001', 'Воздушный фильтр двигателя', 15, 10, 400, 'Mann')
on conflict (part_number) do nothing;
