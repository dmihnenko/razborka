-- Удаление разборки = мягкое: данные (разборка, её заявки/заказы/склад) хранятся ещё
-- 6 месяцев, потом крон удаляет окончательно (CASCADE снесёт все дочерние записи).
alter table public.parts_companies add column if not exists deleted_at timestamptz;
create index if not exists idx_parts_companies_deleted_at on public.parts_companies(deleted_at);

-- Мягкое удаление (только админ): помечаем компанию и деактивируем её пользователей.
create or replace function public.admin_soft_delete_company(p_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только администратор' using errcode = 'P0001'; end if;
  update public.parts_companies set deleted_at = now(), is_active = false where id = p_company_id;
  update public.user_profiles set is_active = false where parts_company_id = p_company_id;
end $$;
grant execute on function public.admin_soft_delete_company(uuid) to authenticated;

-- Восстановление (на случай ошибки) в течение 6 мес.
create or replace function public.admin_restore_company(p_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только администратор' using errcode = 'P0001'; end if;
  update public.parts_companies set deleted_at = null, is_active = true where id = p_company_id;
  update public.user_profiles set is_active = true where parts_company_id = p_company_id;
end $$;
grant execute on function public.admin_restore_company(uuid) to authenticated;

-- Окончательная очистка через 6 месяцев (CASCADE удалит склад/заказы/заявки и т.д.).
create or replace function public.purge_old_deleted_companies()
returns void language sql security definer set search_path = public as $$
  delete from public.parts_companies
  where deleted_at is not null and deleted_at < now() - interval '6 months';
$$;
select cron.unschedule('purge-deleted-companies')
  where exists (select 1 from cron.job where jobname = 'purge-deleted-companies');
select cron.schedule('purge-deleted-companies', '30 1 * * *',
  $$ select public.purge_old_deleted_companies(); $$);
