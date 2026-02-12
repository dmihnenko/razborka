-- Временно упрощаем RLS политику для customers (для отладки)
drop policy if exists "Allow authenticated users to read customers" on customers;
create policy "Allow authenticated users to read customers"
  on customers for select
  using (auth.uid() is not null);

-- Проверяем что политика работает
select 
  c.id, 
  c.name, 
  c.phone, 
  c.sto_company_id,
  auth.uid() as current_user_id
from customers c;
