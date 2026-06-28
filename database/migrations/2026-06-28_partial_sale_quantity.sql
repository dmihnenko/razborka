-- Частичная продажа многоштучного товара.
-- Раньше complete_parts_order ВСЕГДА ставил status='sold', даже если на складе оставалось
-- количество > 0 (продал 3 из 10 гаек → позиция целиком исчезала из наличия).
-- Теперь: вычитаем проданное количество, а «продано» ставим ТОЛЬКО когда остаток дошёл до 0.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-28.

CREATE OR REPLACE FUNCTION public.complete_parts_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE parts_inventory pi
    SET
      quantity = GREATEST(0, pi.quantity - poi.quantity),
      -- остаётся в наличии, пока есть остаток; «продано» — только когда дошли до 0
      status = CASE WHEN pi.quantity - poi.quantity <= 0 THEN 'sold' ELSE pi.status END,
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
$$;
