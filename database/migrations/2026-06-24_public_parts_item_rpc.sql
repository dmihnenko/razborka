-- Фикс: публичная страница запчасти (/public/parts-item/:id) — QR и ссылка — не открывалась у анонима.
-- Причины: (1) select('*') тянул колонки без anon-гранта (sold_price/notes/purchase_price…) → permission error;
--          (2) anon-row-policy отдаёт только status='available' AND selling_price>0 → reserved/sold/без цены
--              (а с авторезервом reserved стало частым) → «Запчасть не найдена».
-- Решение: SECURITY DEFINER RPC отдаёт ТОЛЬКО безопасные поля любой позиции по id, в обход RLS и грантов.
-- Без purchase_price/notes/sold_price/sold_to_customer — приватные поля не утекают.

create or replace function public.get_public_parts_item(p_id uuid)
returns json language sql stable security definer set search_path to 'public' as $fn$
  select json_build_object(
    'id', pi.id, 'name', pi.name, 'part_number', pi.part_number, 'article', pi.article,
    'condition', pi.condition, 'description', pi.description,
    'photos', pi.photos, 'photo_url', pi.photo_url,
    'price_currency', pi.price_currency, 'quantity', pi.quantity,
    'selling_price', pi.selling_price, 'status', pi.status,
    'parts_company_id', pi.parts_company_id,
    'category', (select json_build_object('id',c.id,'name',c.name) from public.parts_categories c where c.id=pi.category_id),
    'vehicle', (select json_build_object('id',v.id,'make',v.make,'model',v.model,'year',v.year,'vin',v.vin) from public.parts_vehicles v where v.id=pi.vehicle_id)
  )
  from public.parts_inventory pi where pi.id = p_id;
$fn$;

revoke all on function public.get_public_parts_item(uuid) from public;
grant execute on function public.get_public_parts_item(uuid) to anon, authenticated;
