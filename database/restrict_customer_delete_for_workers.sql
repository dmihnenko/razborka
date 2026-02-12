-- ========================================
-- ОГРАНИЧЕНИЕ УДАЛЕНИЯ КЛИЕНТОВ ДЛЯ МЕНЕДЖЕРОВ
-- ========================================
-- Менеджеры (sto_worker) могут только переименовывать клиентов, но НЕ удалять
-- Удалять могут только: admin, sto_owner

-- Удаляем старую политику DELETE для customers
drop policy if exists "Allow authenticated users to delete customers" on customers;

-- Создаем новую политику DELETE - только для admin и sto_owner
create policy "Allow admin and sto_owner to delete customers"
  on customers for delete
  using (
    exists (
      select 1 
      from user_profiles up
      join user_roles ur on ur.user_id = up.id
      join roles r on r.id = ur.role_id
      where up.id = auth.uid()
      and up.sto_company_id = customers.sto_company_id
      and r.name in ('admin', 'sto_owner')
    )
  );

-- Проверяем политики для customers
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'customers'
order by cmd, policyname;
