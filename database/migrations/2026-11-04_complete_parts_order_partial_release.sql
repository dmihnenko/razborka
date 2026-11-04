-- Частичная продажа: остаток после завершения заказа не должен зависать в 'reserved'.
-- Если остаток > 0 и позиция не входит в другой незавершённый заказ -> 'available'.
-- Открытые статусы заказа: new, assembling, shipped, in_progress (закрыты: completed, cancelled).
-- Триггер AFTER UPDATE: текущий заказ (NEW.id) из проверки исключается.
-- Идемпотентно (CREATE OR REPLACE). Не применялась автоматически.

CREATE OR REPLACE FUNCTION public.complete_parts_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE parts_inventory pi
    SET
      quantity = GREATEST(0, pi.quantity - poi.quantity),
      -- остаётся в наличии, пока есть остаток; «продано» — только когда дошли до 0.
      -- Остаток без другого открытого заказа возвращается из резерва в 'available'.
      status = CASE
        WHEN pi.quantity - poi.quantity <= 0 THEN 'sold'
        WHEN pi.status = 'reserved' AND NOT EXISTS (
          SELECT 1
          FROM parts_order_items o2
          JOIN parts_orders po2 ON po2.id = o2.order_id
          WHERE o2.inventory_item_id = pi.id
            AND po2.id <> NEW.id
            AND po2.status NOT IN ('completed', 'cancelled')
        ) THEN 'available'
        ELSE pi.status
      END,
      sold_price = CASE WHEN pi.quantity - poi.quantity <= 0
                        THEN COALESCE(pi.sold_price, poi.price_at_sale) ELSE pi.sold_price END,
      sold_at = CASE WHEN pi.quantity - poi.quantity <= 0
                     THEN COALESCE(pi.sold_at, now()) ELSE pi.sold_at END
    FROM parts_order_items poi
    WHERE poi.order_id = NEW.id
      AND pi.id = poi.inventory_item_id
      AND poi.inventory_item_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$function$;
