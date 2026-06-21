-- Разрешаем удаление заявок с маркета членам компании (и админу) — для удаления
-- неоформленных заявок из кабинета. items удаляются каскадом (FK order_id CASCADE).
drop policy if exists market_orders_delete on public.marketplace_orders;
create policy market_orders_delete on public.marketplace_orders
for delete to authenticated
using (
  (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()))
  or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);
