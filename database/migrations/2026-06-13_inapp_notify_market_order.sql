-- In-app уведомление владельцу разборки о новой заявке с маркета.
-- Применено вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
create or replace function public.notify_company_on_market_order() returns trigger
language plpgsql security definer set search_path=public as $fn$
begin
  insert into public.notifications (user_id, type, title, body, link, read)
  select up.id, 'info', 'Новая заявка с маркета',
         'Телефон: ' || coalesce(NEW.buyer_phone,'—') || coalesce(' · ' || NEW.buyer_name, ''),
         '/parts/market-orders', false
  from public.user_profiles up
  join public.user_roles ur on ur.user_id = up.id
  join public.roles r on r.id = ur.role_id
  where up.parts_company_id = NEW.parts_company_id and r.name = 'parts_owner';
  return NEW;
end; $fn$;
drop trigger if exists trg_notify_company_market_order on public.marketplace_orders;
create trigger trg_notify_company_market_order
  after insert on public.marketplace_orders
  for each row execute function public.notify_company_on_market_order();
