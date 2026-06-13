-- Nova Poshta: рефы получателя на клиенте + номер ТТН на заказе (для создания накладных).
-- Применено вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
alter table public.parts_customers add column if not exists np_city_ref text;
alter table public.parts_customers add column if not exists np_warehouse_ref text;
alter table public.parts_orders add column if not exists np_ttn text;
