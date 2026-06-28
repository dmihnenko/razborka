-- Авто-деактивация истёкших подписок (раньше крон waveE не был применён).
-- Серверный enforcement лимитов и так трактует истёкшую подписку как демо (join по end_date>=now),
-- но is_active оставался true — этот крон приводит флаг в порядок ежедневно.
create or replace function public.deactivate_expired_subscriptions()
returns void language sql security definer set search_path = public as $$
  update public.company_subscriptions set is_active = false
  where is_active = true and end_date is not null and end_date < now();
$$;

select cron.unschedule('deactivate-expired-subscriptions')
  where exists (select 1 from cron.job where jobname = 'deactivate-expired-subscriptions');
select cron.schedule('deactivate-expired-subscriptions', '15 0 * * *',
  $$ select public.deactivate_expired_subscriptions(); $$);
