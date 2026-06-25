-- L1 (аудит 2026-06-25): закрыть перебор 4-значных кодов vehicle_share_links.
-- Раньше anon мог читать ВСЕ активные коды (политика "Anyone can read active share links"
-- USING(is_active=true)). Публичная страница авто и RLS personal_vehicles зависели от этого
-- anon-чтения. Переводим проверку шар-линка в SECURITY DEFINER хелперы, резолв кода — в RPC,
-- и убираем прямое anon-чтение таблицы.

-- 1) Есть ли активный (не истёкший) шар-линк у авто — для RLS personal_vehicles
create or replace function public.vehicle_has_active_share(p_vehicle_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.vehicle_share_links
    where vehicle_id = p_vehicle_id and is_active = true
      and (expires_at is null or expires_at > now())
  );
$$;
grant execute on function public.vehicle_has_active_share(uuid) to anon, authenticated;

-- 2) Резолв кода доступа → vehicle_id (для VehicleAccessPage). Без раскрытия таблицы.
create or replace function public.validate_vehicle_share_code(p_code text)
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$
  select vehicle_id from public.vehicle_share_links
  where code = p_code and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;
$$;
grant execute on function public.validate_vehicle_share_code(text) to anon, authenticated;

-- 3) Проверка глобальной уникальности кода при генерации (владелец видит только свои строки)
create or replace function public.vehicle_share_code_taken(p_code text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(select 1 from public.vehicle_share_links
                where code = p_code and is_active = true);
$$;
grant execute on function public.vehicle_share_code_taken(text) to authenticated;

-- 4) RLS personal_vehicles: инлайн-EXISTS → definer-хелпер (anon больше не читает таблицу кодов)
drop policy if exists "Users can view own vehicles or via share code" on public.personal_vehicles;
create policy "Users can view own vehicles or via share code" on public.personal_vehicles
  for select using (auth.uid() = user_id or public.vehicle_has_active_share(id));

-- 5) vehicle_share_links: убрать anon-чтение всех кодов, оставить только владельцу
drop policy if exists "Anyone can read active share links" on public.vehicle_share_links;
drop policy if exists "Users can read own share links" on public.vehicle_share_links;
create policy "Users can read own share links" on public.vehicle_share_links
  for select to authenticated using (auth.uid() = user_id);
