-- SEO: расширяем публичную выдачу запчасти продавцом (разборка) и рейтингом.
-- Нужно воркеру для Product JSON-LD (offers.seller, aggregateRating, гарантия/доставка)
-- и для серверного SEO-body. Приватные поля по-прежнему не отдаём.
-- Применяется вручную через Management API (ref hwckvddevjucuzxdoqqh) 2026-06-28.

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
    'vehicle', (select json_build_object('id',v.id,'make',v.make,'model',v.model,'year',v.year) from public.parts_vehicles v where v.id=pi.vehicle_id),
    -- продавец (разборка) — только публичные поля
    'company', (select json_build_object(
        'id', co.id, 'name', co.name, 'city', co.city,
        'warranty_enabled', co.warranty_enabled, 'warranty_days', co.warranty_days, 'ship_speed', co.ship_speed
      ) from public.parts_companies co where co.id = pi.parts_company_id and co.is_active and co.market_published),
    -- агрегат рейтинга разборки (для aggregateRating)
    'rating', (select json_build_object('avg', round(avg(r.rating)::numeric,1), 'count', count(*))
               from public.parts_reviews r where r.parts_company_id = pi.parts_company_id and r.status = 'published')
  )
  from public.parts_inventory pi where pi.id = p_id;
$fn$;

revoke all on function public.get_public_parts_item(uuid) from public;
grant execute on function public.get_public_parts_item(uuid) to anon, authenticated;
