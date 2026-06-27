-- ПОДПИСКИ (P0): серверный enforcement лимитов тарифа.
-- Раньше лимиты (запчасти/авто) проверялись ТОЛЬКО на клиенте (useSubscriptionLimits)
-- и обходились прямым insert мимо UI. Дублируем проверку в БД как надёжный барьер.
--
-- Логика ровно как на клиенте (src/hooks/useSubscription.ts):
--   • есть активная неистёкшая подписка с планом:
--       max_* = NULL  → безлимит (пропускаем)
--       max_* = число → лимит плана
--   • нет активной подписки → демо-лимиты (50 запчастей / 3 авто)
-- Считаем ТЕКУЩЕЕ число строк; блокируем только новый insert при достижении лимита
-- (существующие строки сверх лимита не трогаем — напр. после даунгрейда).

-- ── Запчасти ───────────────────────────────────────────────────────────────
create or replace function public.enforce_parts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  select s.max_parts into lim
  from company_subscriptions cs
  join subscriptions s on s.id = cs.subscription_id
  where cs.company_id = new.parts_company_id
    and cs.company_type = 'parts'
    and cs.is_active = true
    and (cs.end_date is null or cs.end_date >= now())
  order by cs.end_date desc nulls last
  limit 1;

  if not found then lim := 50; end if;       -- демо-лимит
  if lim is null then return new; end if;    -- безлимитный план

  if (select count(*) from parts_inventory where parts_company_id = new.parts_company_id) >= lim then
    raise exception 'Достигнут лимит запчастей по вашему тарифу (%). Обновите подписку, чтобы добавить больше.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_parts_limit on parts_inventory;
create trigger trg_enforce_parts_limit
  before insert on parts_inventory
  for each row execute function public.enforce_parts_limit();

-- ── Автомобили разборки ──────────────────────────────────────────────────────
create or replace function public.enforce_vehicles_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  select s.max_vehicles into lim
  from company_subscriptions cs
  join subscriptions s on s.id = cs.subscription_id
  where cs.company_id = new.parts_company_id
    and cs.company_type = 'parts'
    and cs.is_active = true
    and (cs.end_date is null or cs.end_date >= now())
  order by cs.end_date desc nulls last
  limit 1;

  if not found then lim := 3; end if;        -- демо-лимит
  if lim is null then return new; end if;    -- безлимитный план

  if (select count(*) from parts_vehicles where parts_company_id = new.parts_company_id) >= lim then
    raise exception 'Достигнут лимит автомобилей по вашему тарифу (%). Обновите подписку, чтобы добавить больше.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_vehicles_limit on parts_vehicles;
create trigger trg_enforce_vehicles_limit
  before insert on parts_vehicles
  for each row execute function public.enforce_vehicles_limit();

-- ── Сотрудники разборки ──────────────────────────────────────────────────────
-- Раньше лимит сотрудников не применялся вообще (даже на клиенте), а Edge-функция
-- create-user его не проверяла. Триггер на user_profiles закрывает дыру независимо
-- от пути создания (create-user, прямой insert). Лимит = число участников компании
-- (как показывает Users.tsx «N/лимит»). Профили без parts_company_id (обычные юзеры)
-- не ограничиваются.
create or replace function public.enforce_workers_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  if new.parts_company_id is null then return new; end if;  -- не сотрудник разборки

  select s.max_workers into lim
  from company_subscriptions cs
  join subscriptions s on s.id = cs.subscription_id
  where cs.company_id = new.parts_company_id
    and cs.company_type = 'parts'
    and cs.is_active = true
    and (cs.end_date is null or cs.end_date >= now())
  order by cs.end_date desc nulls last
  limit 1;

  if not found then lim := 2; end if;        -- демо-лимит
  if lim is null then return new; end if;    -- безлимитный план

  if (select count(*) from user_profiles where parts_company_id = new.parts_company_id) >= lim then
    raise exception 'Достигнут лимит сотрудников по вашему тарифу (%). Обновите подписку, чтобы добавить больше.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_workers_limit on user_profiles;
create trigger trg_enforce_workers_limit
  before insert on user_profiles
  for each row execute function public.enforce_workers_limit();
