-- Публичная витрина /market — привилегия платной подписки.
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-12.
--
-- Разборка публикуется на маркете только при активной ПЛАТНОЙ подписке (цена>0).
-- Демо-доступ (цена 0), отсутствие подписки и истёкшие — не публикуются.
-- Флаг market_published денормализован на parts_companies и поддерживается
-- триггером на company_subscriptions (вкл/выкл/смена/истечение через cron-деактивацию).

alter table public.parts_companies add column if not exists market_published boolean not null default false;

create or replace function public.refresh_market_published(p_company uuid)
returns void language sql security definer set search_path = public as $fn$
  update public.parts_companies pc
     set market_published = exists (
       select 1 from public.company_subscriptions cs
       join public.subscriptions s on s.id = cs.subscription_id
       where cs.company_id = p_company
         and cs.company_type = 'parts'
         and cs.is_active = true
         and (cs.end_date is null or cs.end_date > now())
         and coalesce(s.price, 0) > 0
     )
   where pc.id = p_company;
$fn$;

create or replace function public.trg_refresh_market_published()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_market_published(OLD.company_id);
    return OLD;
  end if;
  perform public.refresh_market_published(NEW.company_id);
  if tg_op = 'UPDATE' and NEW.company_id is distinct from OLD.company_id then
    perform public.refresh_market_published(OLD.company_id);
  end if;
  return NEW;
end;
$fn$;

drop trigger if exists trg_company_subscriptions_market on public.company_subscriptions;
create trigger trg_company_subscriptions_market
  after insert or update or delete on public.company_subscriptions
  for each row execute function public.trg_refresh_market_published();

-- backfill существующих компаний
update public.parts_companies pc set market_published = exists (
  select 1 from public.company_subscriptions cs
  join public.subscriptions s on s.id = cs.subscription_id
  where cs.company_id = pc.id and cs.company_type = 'parts' and cs.is_active = true
    and (cs.end_date is null or cs.end_date > now()) and coalesce(s.price, 0) > 0
);
