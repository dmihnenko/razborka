-- Подписки: канонический Демо-план + назначение админом на N месяцев + истечение → Демо.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-29.
--
-- Было: триггер демо на новый аккаунт искал план по price=0 AND is_active=true → попадал на
-- «Премиум» (кастом, безлимит); Демо-план был is_active=false; крон истечения просто ставил
-- is_active=false (на демо не переводил). Чиним всё через явный флаг is_demo.

-- ── 1. Канонический Демо-план ────────────────────────────────────────────────
alter table public.subscriptions add column if not exists is_demo boolean not null default false;

-- активируем существующий демо-план, помечаем is_demo, фиксируем лимиты (50/3/2, без аналитики)
update public.subscriptions set
  is_active = true, is_demo = true, price = 0, company_type = 'parts',
  name = 'Демо',
  description = 'Бесплатный демо-доступ · 50 запчастей · 3 авто · 2 сотрудника',
  max_parts = 50, max_vehicles = 3, max_workers = 2, has_analytics = false, sort_order = 0
where id = '6d63c3c1-7cda-4379-8035-48893eb34a45';

-- ровно один демо-план: снять флаг с любых других (в т.ч. Премиум price=0)
update public.subscriptions set is_demo = false
where is_demo and id <> '6d63c3c1-7cda-4379-8035-48893eb34a45';

-- существующие демо-подписки компаний → бессрочно (демо = базовый уровень, без срока)
update public.company_subscriptions set end_date = null, updated_at = now()
where company_type = 'parts'
  and subscription_id in (select id from public.subscriptions where is_demo)
  and end_date is not null;

-- ── 2. Новый аккаунт разборки → Демо (по is_demo, бессрочно) ──────────────────
create or replace function public.assign_demo_subscription_to_parts()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare demo_id uuid;
begin
  select id into demo_id from public.subscriptions
    where company_type = 'parts' and is_demo and is_active
    order by created_at limit 1;
  if demo_id is not null then
    insert into public.company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active)
    values ('parts', NEW.id, demo_id, now(), null, true)  -- бессрочно
    on conflict (company_type, company_id) do nothing;
  end if;
  return NEW;
exception when others then
  raise warning 'assign_demo_subscription_to_parts failed: %', SQLERRM;
  return NEW;
end; $fn$;

-- ── 3. Админ назначает план на N месяцев (1/2/3/любое; null = бессрочно) ───────
create or replace function public.admin_set_company_subscription(
  p_company_id uuid, p_plan_id uuid, p_months int default null
)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Только администратор' using errcode = '42501';
  end if;
  if not exists (select 1 from public.subscriptions where id = p_plan_id and is_active) then
    raise exception 'План не найден или неактивен' using errcode = 'P0001';
  end if;
  delete from public.company_subscriptions
    where company_type = 'parts' and company_id = p_company_id;
  insert into public.company_subscriptions
    (company_type, company_id, subscription_id, start_date, end_date, is_active)
  values ('parts', p_company_id, p_plan_id, now(),
          case when p_months is null or p_months <= 0 then null
               else now() + make_interval(months => p_months) end,
          true);
end; $fn$;
revoke all on function public.admin_set_company_subscription(uuid, uuid, int) from public;
grant execute on function public.admin_set_company_subscription(uuid, uuid, int) to authenticated;

-- ── 4. Истечение оплаченной подписки → Демо (а не просто деактивация) ─────────
create or replace function public.deactivate_expired_subscriptions()
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare demo_id uuid;
begin
  select id into demo_id from public.subscriptions
    where company_type = 'parts' and is_demo and is_active
    order by created_at limit 1;

  if demo_id is not null then
    -- истёкшие parts-подписки (кроме самих демо) → переводим на Демо бессрочно
    update public.company_subscriptions
      set subscription_id = demo_id, start_date = now(), end_date = null,
          is_active = true, updated_at = now()
      where company_type = 'parts' and is_active
        and end_date is not null and end_date < now()
        and subscription_id <> demo_id;
  else
    -- фолбэк: если демо-плана нет — старое поведение для parts
    update public.company_subscriptions set is_active = false
      where company_type = 'parts' and is_active
        and end_date is not null and end_date < now();
  end if;

  -- не-parts (наследие STO и пр.) — просто деактивируем истёкшие
  update public.company_subscriptions set is_active = false
    where company_type <> 'parts' and is_active
      and end_date is not null and end_date < now();
end; $fn$;
