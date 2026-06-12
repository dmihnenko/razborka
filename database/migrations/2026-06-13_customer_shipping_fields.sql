-- Данные доставки на карточке клиента разборки (Новая почта).
-- Применено вручную через Supabase Management API (ref hwckvddevjucuzxdoqqh) 2026-06-13.
-- city — город доставки; np_office — отделение Новой почты.
-- Заполняются при оформлении заказа; клиент формируется при переходе заказа
-- в работу/завершение, его заказы видны по customer_id.

alter table public.parts_customers add column if not exists city text;
alter table public.parts_customers add column if not exists np_office text;
