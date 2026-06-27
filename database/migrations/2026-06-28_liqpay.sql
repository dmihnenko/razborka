-- ПОДПИСКИ: онлайн-оплата LiqPay. КЛЮЧЕВОЕ: активация подписки происходит ТОЛЬКО по
-- серверному callback LiqPay (worker проверяет HMAC-подпись приватным ключом), а не по
-- редиректу/слову клиента. Клиент лишь инициирует оплату и получает ссылку на LiqPay.

-- 1) Платежи (источник правды по деньгам). Только чтение владельцем/админом; пишут DEFINER-RPC.
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  company_type text not null default 'parts',
  company_id uuid not null references public.parts_companies(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id),
  months int not null default 1,
  amount numeric not null,
  currency text not null default 'UAH',
  description text,
  provider text not null default 'liqpay',
  liqpay_payment_id text,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  created_at timestamptz default now(),
  paid_at timestamptz
);
create index if not exists idx_sub_payments_company on public.subscription_payments(company_id, created_at desc);

alter table public.subscription_payments enable row level security;
drop policy if exists sp_select on public.subscription_payments;
create policy sp_select on public.subscription_payments
  for select to authenticated
  using (public.is_admin() or company_id = public.my_parts_company_id());
-- INSERT/UPDATE — нет клиентских политик: только через SECURITY DEFINER RPC ниже.

-- 2) Внутренний секрет worker→БД для применения callback (как cron_rate_secret).
insert into public.app_private(key, value)
values ('liqpay_callback_secret', '__SET_VIA_DASHBOARD__')
on conflict (key) do nothing;

-- 3) Расчёт суммы (зеркало src/config/subscriptionPlans.ts tierTermPrice: год −15%, округл. до 10).
create or replace function public.calc_sub_amount(p_monthly numeric, p_months int)
returns numeric language sql immutable as $$
  select round( (p_monthly * p_months * (case when p_months >= 12 then 0.85 else 1 end)) / 10 ) * 10
$$;

-- 4) Создать pending-платёж (вызывает владелец разборки). Сумма считается на сервере (анти-подмена).
create or replace function public.liqpay_create_pending(p_subscription_id uuid, p_months int)
returns table(order_id text, amount numeric, description text)
language plpgsql security definer set search_path = public as $$
declare cid uuid; plan public.subscriptions%rowtype; oid text; amt numeric; m int;
begin
  if not public.is_parts_owner() then raise exception 'forbidden' using errcode='P0001'; end if;
  cid := public.my_parts_company_id();
  if cid is null then raise exception 'no company' using errcode='P0001'; end if;
  select * into plan from public.subscriptions where id = p_subscription_id and is_active = true;
  if not found then raise exception 'plan not found' using errcode='P0001'; end if;
  m := case when p_months >= 12 then 12 else 1 end;
  amt := public.calc_sub_amount(plan.price, m);
  if amt is null or amt <= 0 then raise exception 'invalid amount' using errcode='P0001'; end if;
  oid := 'sub_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.subscription_payments(order_id, company_id, subscription_id, months, amount, description)
    values (oid, cid, p_subscription_id, m, amt, 'Подписка ' || plan.name || ' · ' || m || ' мес · Razborka.net');
  order_id := oid; amount := amt;
  description := 'Подписка ' || plan.name || ' · ' || m || ' мес · Razborka.net';
  return next;
end $$;
grant execute on function public.liqpay_create_pending(uuid, int) to authenticated;

-- 5) Применить callback LiqPay (вызывает worker ПОСЛЕ проверки подписи). Идемпотентно,
--    защищено внутренним секретом + сверкой суммы. Активирует/продлевает подписку.
create or replace function public.liqpay_apply_callback(
  p_order_id text, p_status text, p_liqpay_id text, p_amount numeric, p_secret text)
returns text language plpgsql security definer set search_path = public as $$
declare pay public.subscription_payments%rowtype; base timestamptz; newend timestamptz;
begin
  if p_secret is null or p_secret <> (select value from public.app_private where key='liqpay_callback_secret') then
    raise exception 'forbidden' using errcode='P0001';
  end if;
  select * into pay from public.subscription_payments where order_id = p_order_id;
  if not found then return 'unknown_order'; end if;
  if pay.status = 'success' then return 'already'; end if;          -- идемпотентность

  if p_status not in ('success','sandbox','wait_accept','subscribed') then
    update public.subscription_payments set status='failed', liqpay_payment_id=p_liqpay_id where order_id=p_order_id;
    return 'failed';
  end if;
  if p_amount is not null and abs(p_amount - pay.amount) > 0.5 then  -- анти-подмена суммы
    update public.subscription_payments set status='failed', liqpay_payment_id=p_liqpay_id where order_id=p_order_id;
    return 'amount_mismatch';
  end if;

  update public.subscription_payments set status='success', liqpay_payment_id=p_liqpay_id, paid_at=now()
    where order_id=p_order_id;

  -- продлеваем от max(now, текущий конец): новый срок не «съедает» оплаченное
  select greatest(now(), coalesce(max(end_date), now())) into base from public.company_subscriptions
    where company_id=pay.company_id and company_type='parts' and is_active=true and end_date is not null;
  if base is null then base := now(); end if;
  newend := base + (pay.months || ' months')::interval;

  update public.company_subscriptions set is_active=false
    where company_id=pay.company_id and company_type='parts';
  insert into public.company_subscriptions(company_type, company_id, subscription_id, start_date, end_date, is_active)
    values ('parts', pay.company_id, pay.subscription_id, now(), newend, true);

  return 'activated';
end $$;
-- callable воркером с anon-ключом, защищён p_secret (как set_global_usd_rate)
grant execute on function public.liqpay_apply_callback(text, text, text, numeric, text) to anon, authenticated;
