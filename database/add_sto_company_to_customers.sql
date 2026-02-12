-- Добавляем sto_company_id к таблице customers
alter table customers add column if not exists sto_company_id uuid references sto_companies(id) on delete cascade;

-- Создаем индекс для производительности
create index if not exists idx_customers_sto_company on customers(sto_company_id);

-- Обновляем RLS политики для customers
drop policy if exists "Allow authenticated users to read customers" on customers;
create policy "Allow authenticated users to read customers"
  on customers for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and (user_profiles.sto_company_id = customers.sto_company_id or user_profiles.sto_company_id is null)
    )
  );

drop policy if exists "Allow authenticated users to insert customers" on customers;
create policy "Allow authenticated users to insert customers"
  on customers for insert
  with check (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = customers.sto_company_id
    )
  );

drop policy if exists "Allow authenticated users to update customers" on customers;
create policy "Allow authenticated users to update customers"
  on customers for update
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = customers.sto_company_id
    )
  );

drop policy if exists "Allow authenticated users to delete customers" on customers;
create policy "Allow authenticated users to delete customers"
  on customers for delete
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.sto_company_id = customers.sto_company_id
    )
  );
