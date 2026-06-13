-- Аудит-лог кабинета: кто/когда менял статус заказа и цену позиции.
-- Применено вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
create table if not exists public.parts_activity_log (
  id uuid primary key default gen_random_uuid(),
  parts_company_id uuid not null,
  user_id uuid,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_parts_activity_company on public.parts_activity_log(parts_company_id, created_at desc);
alter table public.parts_activity_log enable row level security;
drop policy if exists parts_activity_read on public.parts_activity_log;
create policy parts_activity_read on public.parts_activity_log for select to authenticated
  using (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid())
         or exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='admin'));
grant select on public.parts_activity_log to authenticated;

create or replace function public.log_order_status_change() returns trigger
language plpgsql security definer set search_path=public as $fn$
begin
  if TG_OP='UPDATE' and NEW.status is distinct from OLD.status then
    insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
    values (NEW.parts_company_id, auth.uid(), 'order', NEW.id, NEW.order_number, 'status_change',
            'Статус заказа: ' || coalesce(OLD.status,'—') || ' → ' || coalesce(NEW.status,'—'));
  end if; return NEW;
end; $fn$;
drop trigger if exists trg_log_order_status on public.parts_orders;
create trigger trg_log_order_status after update on public.parts_orders for each row execute function public.log_order_status_change();

create or replace function public.log_inventory_price_change() returns trigger
language plpgsql security definer set search_path=public as $fn$
begin
  if TG_OP='UPDATE' and NEW.selling_price is distinct from OLD.selling_price then
    insert into public.parts_activity_log(parts_company_id,user_id,entity_type,entity_id,entity_label,action,detail)
    values (NEW.parts_company_id, auth.uid(), 'inventory', NEW.id, NEW.name, 'price_change',
            'Цена: ' || coalesce(OLD.selling_price::text,'—') || ' → ' || coalesce(NEW.selling_price::text,'—') || ' ' || coalesce(NEW.price_currency,''));
  end if; return NEW;
end; $fn$;
drop trigger if exists trg_log_inventory_price on public.parts_inventory;
create trigger trg_log_inventory_price after update on public.parts_inventory for each row execute function public.log_inventory_price_change();
