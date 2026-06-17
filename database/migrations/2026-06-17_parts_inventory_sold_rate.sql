-- Фиксация курса доллара и даты на момент продажи запчасти.
-- Зачем: окупаемость авто должна считаться по курсу, который был В МОМЕНТ продажи,
-- а не по живому текущему (иначе история «плывёт» при каждом изменении курса).

ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exchange_rate_at_sale DECIMAL(10,4);

-- Триггер завершения заказа теперь замораживает на запчасти и дату продажи,
-- и курс (из заказа), и валюту позиции. COALESCE — чтобы не перезатереть уже
-- зафиксированные значения при повторном срабатывании.
CREATE OR REPLACE FUNCTION public.complete_parts_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE parts_inventory pi
    SET
      quantity   = GREATEST(0, pi.quantity - poi.quantity),
      status     = 'sold',
      sold_price = COALESCE(pi.sold_price, poi.price_at_sale),
      price_currency        = COALESCE(poi.price_at_sale_currency, pi.price_currency),
      sold_at               = COALESCE(pi.sold_at, NOW()),
      exchange_rate_at_sale = COALESCE(pi.exchange_rate_at_sale, NEW.exchange_rate_at_sale)
    FROM parts_order_items poi
    WHERE poi.order_id = NEW.id
      AND pi.id = poi.inventory_item_id
      AND poi.inventory_item_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Бэкфилл истории: уже проданным запчастям проставляем курс/дату из их заказа.
UPDATE parts_inventory pi
SET exchange_rate_at_sale = o.exchange_rate_at_sale,
    sold_at = COALESCE(pi.sold_at, o.updated_at, o.order_date)
FROM parts_order_items poi
JOIN parts_orders o ON o.id = poi.order_id
WHERE pi.id = poi.inventory_item_id
  AND pi.status = 'sold'
  AND pi.exchange_rate_at_sale IS NULL
  AND o.status = 'completed'
  AND o.exchange_rate_at_sale IS NOT NULL;
