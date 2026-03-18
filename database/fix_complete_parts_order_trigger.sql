-- Исправляем триггер complete_parts_order:
-- 1. Убираем RAISE EXCEPTION (он вызывает 400 и роллбек, но фронтенд не проверяет ошибку → следующая попытка уходит в минус)
-- 2. GREATEST(0, ...) — количество никогда не уйдёт в отрицательное
-- 3. Сразу ставим status='sold' на запчасти (не нужно делать это отдельно с фронтенда)
-- 4. Убираем sold_quantity — колонки может не существовать, что само по себе вызывает ошибку

CREATE OR REPLACE FUNCTION public.complete_parts_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE parts_inventory pi
    SET
      quantity  = GREATEST(0, pi.quantity - poi.quantity),
      status    = 'sold',
      sold_price = COALESCE(pi.sold_price, poi.price_at_sale)
    FROM parts_order_items poi
    WHERE poi.order_id = NEW.id
      AND pi.id = poi.inventory_item_id
      AND poi.inventory_item_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;
