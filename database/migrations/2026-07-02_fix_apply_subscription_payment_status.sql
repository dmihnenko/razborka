-- Фикс: apply_company_subscription вставлял subscription_payments.status='paid',
-- но CHECK разрешает только pending/success/failed -> 23514, апгрейд/назначение
-- платного тарифа админом падал (subscription_payments в проде был пуст).
-- Меняем 'paid' -> 'success' (канонический статус успешной оплаты, как в LiqPay).

CREATE OR REPLACE FUNCTION public.apply_company_subscription(p_company_id uuid, p_plan_id uuid, p_months integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  P            record;   -- выбранный план
  C           record;    -- текущая активная подписка (+ её план)
  v_termless  boolean;
  v_months    int;
  v_end       timestamptz;
  v_amount    numeric;
begin
  if not public.is_admin() then
    raise exception 'Только администратор' using errcode = '42501';
  end if;

  select id, name, type, price, coalesce(sort_order, 0) as level, coalesce(is_demo, false) as is_demo
    into P
  from public.subscriptions
  where id = p_plan_id and is_active;
  if not found then
    raise exception 'План не найден или неактивен' using errcode = 'P0001';
  end if;

  v_termless := (P.price = 0 or P.type = 'lifetime');
  -- срок: для termless игнорируем; иначе минимум 1 месяц
  v_months   := case when v_termless then null else greatest(1, coalesce(p_months, 1)) end;
  v_end      := case when v_termless then null else now() + make_interval(months => v_months) end;

  -- текущая активная подписка компании + уровень её плана
  select cs.id, cs.subscription_id, cs.end_date,
         coalesce(s.sort_order, 0) as level, coalesce(s.is_demo, false) as is_demo
    into C
  from public.company_subscriptions cs
  join public.subscriptions s on s.id = cs.subscription_id
  where cs.company_type = 'parts' and cs.company_id = p_company_id and cs.is_active
  limit 1;

  -- ── Кейс 2: тот же тариф → ПРОДЛИТЬ ───────────────────────────────────────
  if found and C.subscription_id = p_plan_id then
    update public.company_subscriptions
      set end_date = case
            when v_termless then null
            else greatest(coalesce(C.end_date, now()), now()) + make_interval(months => v_months)
          end,
          status = 'active', is_active = true, expiry_notified_at = null, updated_at = now()
      where id = C.id;

  -- ── Кейс 4: ДАУНГРЕЙД (Clevel > Plevel) → P в очередь (scheduled) ──────────
  elsif found and not C.is_demo and C.level > P.level then
    -- убрать прежние неактивные строки этого же плана (чтобы не плодить дубль-очередь)
    delete from public.company_subscriptions
      where company_type = 'parts' and company_id = p_company_id
        and not is_active and subscription_id = p_plan_id;
    insert into public.company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active, status, sched_months)
    values
      ('parts', p_company_id, p_plan_id, null, null, false, 'scheduled', v_months);

  -- ── Кейс 3: АПГРЕЙД (Clevel < Plevel, C не демо) → заморозить C, P active ──
  elsif found and not C.is_demo and C.level < P.level then
    update public.company_subscriptions
      set is_active = false, status = 'frozen',
          remaining_days = case when C.end_date is null then null
                                else greatest(0, ceil(extract(epoch from (C.end_date - now())) / 86400))::int end,
          updated_at = now()
      where id = C.id;
    insert into public.company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active, status)
    values
      ('parts', p_company_id, p_plan_id, now(), v_end, true, 'active');

  -- ── Кейс 1: C нет ИЛИ C демо → завершить C, вставить P active ──────────────
  else
    if found then
      -- завершаем текущую активную (демо/прочее): помечаем ended, снимаем активность
      update public.company_subscriptions
        set is_active = false, status = 'ended', updated_at = now()
        where id = C.id;
    end if;
    insert into public.company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active, status)
    values
      ('parts', p_company_id, p_plan_id, now(), v_end, true, 'active');
  end if;

  -- ── Платёж за платный P (как admin_set_company_subscription) ───────────────
  if not v_termless then
    v_amount := public.calc_sub_amount(P.price, v_months);
    insert into public.subscription_payments
      (order_id, company_type, company_id, subscription_id, months, amount, currency,
       description, provider, status, paid_at)
    values
      ('manual-' || gen_random_uuid(), 'parts', p_company_id, p_plan_id, v_months, v_amount, 'UAH',
       'Назначение тарифа администратором', 'manual', 'success', now());
  end if;
end;
$function$

