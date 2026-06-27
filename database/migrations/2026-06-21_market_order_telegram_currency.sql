-- Фикс итога в Telegram-уведомлении заявки с маркета: считать суммы РАЗДЕЛЬНО
-- по валютам (грн и $), а не складывать в одно число. Итог: «8000 грн + 200 $».
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
  v_total numeric := 0;        -- наивная сумма для total_amount (для одной валюты корректна)
  v_total_uah numeric := 0;
  v_total_usd numeric := 0;
  it jsonb;
  v_name text;
  v_qty int;
  v_price numeric;
  v_cur text;
  v_make_model text;
  v_items text := '';
  v_total_line text := '';
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
    if v_cur = 'USD' then v_total_usd := v_total_usd + v_price * v_qty;
    else                  v_total_uah := v_total_uah + v_price * v_qty;
    end if;

    -- Марка+модель авто (для сборки), без привязки к VIN/конкретной записи
    v_make_model := null;
    if nullif(it->>'inventory_id','') is not null then
      select nullif(trim(coalesce(v.make,'') || ' ' || coalesce(v.model,'')), '')
        into v_make_model
      from public.parts_inventory pi
      left join public.parts_vehicles v on v.id = pi.vehicle_id
      where pi.id = (it->>'inventory_id')::uuid;
    end if;

    v_items := v_items || E'\n• ' || v_name ||
               coalesce(' · ' || v_make_model, '') ||
               ' ×' || v_qty ||
               case when v_price > 0
                    then ' — ' || to_char(round(v_price), 'FM999999990') || ' ' || (case when v_cur = 'USD' then '$' else 'грн' end)
                    else '' end;
  end loop;

  update public.marketplace_orders set total_amount = v_total where id = v_order_id;

  -- Итог по валютам (только присутствующие): «8000 грн», «200 $», или «8000 грн + 200 $»
  if v_total_uah > 0 then
    v_total_line := to_char(round(v_total_uah), 'FM999999990') || ' грн';
  end if;
  if v_total_usd > 0 then
    if length(v_total_line) > 0 then v_total_line := v_total_line || ' + '; end if;
    v_total_line := v_total_line || to_char(round(v_total_usd), 'FM999999990') || ' $';
  end if;
  if length(v_total_line) = 0 then v_total_line := '0'; end if;

  v_text := '🛒 <b>Новая заявка с маркета</b>' || E'\n' ||
            '📞 ' || coalesce(p_buyer_phone, '—') ||
            coalesce(E'\n👤 ' || nullif(trim(p_buyer_name), ''), '') ||
            coalesce(E'\n💬 ' || nullif(trim(p_comment), ''), '') ||
            E'\n\n<b>Позиции:</b>' || v_items ||
            E'\n\n💰 <b>Итого: ' || v_total_line || '</b>';

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
