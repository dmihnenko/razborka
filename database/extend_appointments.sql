-- Розширення таблиці appointments для підтримки списків робіт і запчастин
-- Додає JSON поля та поля для обчислення вартості

-- Додаємо поля для відділу (СТО компанія)
alter table appointments add column if not exists sto_company_id uuid references sto_companies(id) on delete cascade;

-- Додаємо поля для робіт та запчастин
alter table appointments add column if not exists work_items jsonb default '[]'::jsonb;
alter table appointments add column if not exists part_items jsonb default '[]'::jsonb;

-- Додаємо поля для вартості
alter table appointments add column if not exists total_work_cost numeric(10,2) default 0;
alter table appointments add column if not exists total_parts_cost numeric(10,2) default 0;
alter table appointments add column if not exists total_cost numeric(10,2) default 0;

-- Оновлюємо можливі статуси
alter table appointments drop constraint if exists appointments_status_check;
alter table appointments add constraint appointments_status_check 
  check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'paid'));

-- Встановлюємо дефолтний статус як 'pending'
alter table appointments alter column status set default 'pending';

-- Додаємо індекси для покращення продуктивності
create index if not exists idx_appointments_sto_company on appointments(sto_company_id);
create index if not exists idx_appointments_status on appointments(status);

-- Оновлюємо updated_at при змінах
alter table appointments add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

create or replace function update_appointments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists appointments_updated_at_trigger on appointments;
create trigger appointments_updated_at_trigger
  before update on appointments
  for each row
  execute function update_appointments_updated_at();

-- Оновлюємо RLS політики для підтримки sto_company_id
drop policy if exists "Allow authenticated users to read appointments" on appointments;
create policy "Allow authenticated users to read appointments"
  on appointments for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and (user_profiles.sto_company_id = appointments.sto_company_id or user_profiles.sto_company_id is null)
    )
  );

drop policy if exists "Allow authenticated users to insert appointments" on appointments;
create policy "Allow authenticated users to insert appointments"
  on appointments for insert
  with check (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = appointments.sto_company_id
    )
  );

drop policy if exists "Allow authenticated users to update appointments" on appointments;
create policy "Allow authenticated users to update appointments"
  on appointments for update
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = appointments.sto_company_id
    )
  );

drop policy if exists "Allow authenticated users to delete appointments" on appointments;
create policy "Allow authenticated users to delete appointments"
  on appointments for delete
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = appointments.sto_company_id
    )
  );

comment on column appointments.work_items is 'JSON масив робіт: {id, name, description, price, isPaid, paidAt, notes}';
comment on column appointments.part_items is 'JSON масив запчастин: {id, name, articleNumber, quantity, price, totalPrice, condition, isPaid, paidAt, supplier, notes}';
comment on column appointments.total_work_cost is 'Загальна вартість робіт';
comment on column appointments.total_parts_cost is 'Загальна вартість запчастин';
comment on column appointments.total_cost is 'Загальна вартість (роботи + запчастини)';
