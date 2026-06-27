-- Красивое Telegram-уведомление о заявке с маркета: с перечнем позиций и итогом.
-- Раньше Telegram слал AFTER INSERT триггер на marketplace_orders — но позиции
-- вставляются ПОСЛЕ (в RPC), поэтому списка и суммы не было.
-- Решение: триггер оставляем ТОЛЬКО на in-app уведомление, а Telegram со всем
-- содержимым шлём из RPC submit_marketplace_order в самом конце (после позиций+суммы).

-- 1) Триггерная функция — снова только in-app (без Telegram, чтобы не дублировать)
create or replace function public.notify_company_on_market_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
end;
$function$;

-- 2) RPC: вставляет заявку + позиции, считает сумму и шлёт полное Telegram-сообщение
create or replace function public.submit_marketplace_order(
  p_company_id uuid, p_buyer_phone text, p_buyer_name text, p_comment text, p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_total numeric := 0;
  it jsonb;
  v_name text;
  v_qty int;
  v_price numeric;
  v_cur text;
  v_items text := '';
  v_curr text := null;
  v_mixed boolean := false;
  v_text text;
begin
  if p_buyer_phone is null or length(regexp_replace(p_buyer_phone, '\D', '', 'g')) < 7 then
    raise exception 'Некорректный телефон';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Пустой заказ';
  end if;

  insert into public.marketplace_orders (parts_company_id, buyer_phone, buyer_name, comment)
  values (p_company_id, p_buyer_phone, nullif(trim(p_buyer_name), ''), nullif(trim(p_comment), ''))
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_name  := coalesce(it->>'name','Запчасть');
    v_qty   := greatest(coalesce((it->>'quantity')::int, 1), 1);
    v_price := coalesce(nullif(it->>'selling_price','')::numeric, 0);
    v_cur   := coalesce(it->>'price_currency','UAH');

    insert into public.marketplace_order_items (order_id, inventory_id, name, selling_price, price_currency, quantity, photo_url)
    values (
      v_order_id,
      nullif(it->>'inventory_id','')::uuid,
      v_name,
      nullif(it->>'selling_price','')::numeric,
      v_cur,
      v_qty,
      it->>'photo_url'
    );

    v_total := v_total + v_price * v_qty;
    if v_curr is null then v_curr := v_cur; elsif v_curr <> v_cur then v_mixed := true; end if;

    v_items := v_items || E'\n• ' || v_name || ' ×' || v_qty ||
               case when v_price > 0
                    then ' — ' || to_char(round(v_price), 'FM999999990') || ' ' || (case when v_cur = 'USD' then '$' else 'грн' end)
                    else '' end;
  end loop;

  update public.marketplace_orders set total_amount = v_total where id = v_order_id;

  -- Полное Telegram-уведомление (если у компании привязан бот — функция проверит chat_id)
  v_text := '🛒 <b>Новая заявка с маркета</b>' || E'\n' ||
            '📞 ' || coalesce(p_buyer_phone, '—') ||
            coalesce(E'\n👤 ' || nullif(trim(p_buyer_name), ''), '') ||
            coalesce(E'\n💬 ' || nullif(trim(p_comment), ''), '') ||
            E'\n\n<b>Позиции:</b>' || v_items ||
            E'\n\n💰 <b>Итого: ' || to_char(round(v_total), 'FM999999990') ||
            case when not v_mixed and v_curr is not null then ' ' || (case when v_curr = 'USD' then '$' else 'грн' end) else '' end ||
            '</b>';

  perform net.http_post(
    url     := 'https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-internal-secret', (select value from public.app_private where key='notify_secret')),
    body    := jsonb_build_object('company_id', p_company_id, 'text', v_text)
  );

  return v_order_id;
end;
$function$;
