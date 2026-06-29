-- История платежей подписок: ручное назначение платного тарифа админом тоже пишет
-- запись в subscription_payments (раньше туда писал только LiqPay-callback) + RPC чтения
-- для админа. Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-30.

-- ── admin_set_company_subscription: + запись платежа для платных планов ───────
create or replace function public.admin_set_company_subscription(
  p_company_id uuid, p_plan_id uuid, p_months int default null
)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare v_price numeric; v_name text; v_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'Только администратор' using errcode = '42501';
  end if;
  select price, name into v_price, v_name from public.subscriptions where id = p_plan_id and is_active;
  if v_name is null then
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

  -- платный план → запись в историю платежей (manual)
  if coalesce(v_price, 0) > 0 then
    v_amount := case when p_months is null or p_months <= 0 then v_price
                     else public.calc_sub_amount(v_price, p_months) end;
    insert into public.subscription_payments
      (order_id, company_type, company_id, subscription_id, months, amount, currency,
       description, provider, status, paid_at)
    values ('manual-' || gen_random_uuid(), 'parts', p_company_id, p_plan_id,
            coalesce(p_months, 0), v_amount, 'UAH',
            'Назначено администратором: ' || v_name, 'manual', 'paid', now());
  end if;
end; $fn$;

-- ── Чтение истории платежей (только админ) ───────────────────────────────────
create or replace function public.admin_get_subscription_payments(p_limit int default 100)
returns table (
  id uuid, company text, plan text, months int, amount numeric, currency text,
  provider text, status text, created_at timestamptz, paid_at timestamptz
)
language sql stable security definer set search_path to 'public' as $fn$
  select sp.id, c.name::text, s.name::text, sp.months, sp.amount, sp.currency,
         sp.provider, sp.status, sp.created_at, sp.paid_at
  from public.subscription_payments sp
  left join public.parts_companies c on c.id = sp.company_id
  left join public.subscriptions   s on s.id = sp.subscription_id
  where public.is_admin()
  order by sp.created_at desc
  limit greatest(1, least(p_limit, 500));
$fn$;
revoke all on function public.admin_get_subscription_payments(int) from public;
grant execute on function public.admin_get_subscription_payments(int) to authenticated;
