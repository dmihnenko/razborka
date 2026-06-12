-- Волна B: конвертация заявки маркета → заказ разборки в 1 клик.
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-12.
--
-- converted_order_id связывает заявку покупателя (marketplace_orders) с созданным
-- из неё заказом (parts_orders). Защищает от повторной конвертации и даёт ссылку
-- «перейти к заказу». on delete set null — если заказ удалят, заявка не пропадёт.

alter table public.marketplace_orders
  add column if not exists converted_order_id uuid references public.parts_orders(id) on delete set null;
