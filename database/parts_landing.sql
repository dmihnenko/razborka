-- ============================================================================
-- TSP — Лендинг авторазборок: заявки, тарифы, оповещения
-- Применено 2026-06-12 к tsp.pp.ua (hwckvddevjucuzxdoqqh).
-- ============================================================================

begin;

-- 1) Доп. поля заявки (форма лендинга: марки авто + ФИО владельца) ───────────
alter table public.access_requests add column if not exists vehicle_makes text;
alter table public.access_requests add column if not exists owner_name text;

-- 2) Фич-флаг тарифа: доступны ли «Аналитика/Окупаемость» ─────────────────────
alter table public.subscriptions add column if not exists has_analytics boolean not null default false;

-- 3) Канонические тарифы авторазборок (обновляем существующие планы по id) ─────
-- Пакет 1 — 400₴: 2 авто, 50 запчастей, 2 сотрудника, без аналитики
update public.subscriptions set
  name='Пакет 1', description='2 авто · 50 запчастей · 2 сотрудника',
  price=400, type='monthly', company_type='parts',
  max_vehicles=2, max_parts=50, max_workers=2, has_analytics=false,
  is_custom=false, is_active=true, sort_order=1
where id='3b620646-0fd1-41fc-8eb0-cd383957cb20';

-- Пакет 2 — 600₴: 2 авто, 150 запчастей, 3 сотрудника, без аналитики
update public.subscriptions set
  name='Пакет 2', description='2 авто · 150 запчастей · 3 сотрудника',
  price=600, type='monthly', company_type='parts',
  max_vehicles=2, max_parts=150, max_workers=3, has_analytics=false,
  is_custom=false, is_active=true, sort_order=2
where id='5a9096fa-5559-41b2-b2ff-8f91a24b5e33';

-- Пакет 3 — 800₴: до 5 авто, 400 запчастей, без огр. сотрудников, + аналитика
update public.subscriptions set
  name='Пакет 3', description='до 5 авто · 400 запчастей · сотрудники без лимита · аналитика и окупаемость',
  price=800, type='monthly', company_type='parts',
  max_vehicles=5, max_parts=400, max_workers=null, has_analytics=true,
  is_custom=false, is_active=true, sort_order=3
where id='d278e59e-1465-4fa6-be07-83ad2fb65dd5';

-- Премиум — индивидуальный: лимиты индивидуально, полный функционал
update public.subscriptions set
  name='Премиум', description='Индивидуальные лимиты · полный функционал и все будущие модули',
  type='monthly', company_type='parts',
  max_vehicles=null, max_parts=null, max_workers=null, has_analytics=true,
  is_custom=true, is_active=true, sort_order=4
where id='4efc9104-8c3f-4d3e-94ea-943e7a1bf8f6';

-- Прочие/легаси планы скрываем из лендинга (на компании, если есть, не влияет)
update public.subscriptions set is_active=false
where company_type='parts'
  and id not in (
    '3b620646-0fd1-41fc-8eb0-cd383957cb20',
    '5a9096fa-5559-41b2-b2ff-8f91a24b5e33',
    'd278e59e-1465-4fa6-be07-83ad2fb65dd5',
    '4efc9104-8c3f-4d3e-94ea-943e7a1bf8f6'
  );

-- 4) Оповещения пользователю (in-app) ────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null default 'info',     -- info | success | warning
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

grant select, update on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

alter table public.notifications enable row level security;

-- читать/обновлять свои уведомления
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid()
    or exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
               where ur.user_id=auth.uid() and r.name='admin'));
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid());
-- создавать уведомления может админ (для одобрения заявок)
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated
  with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
                      where ur.user_id=auth.uid() and r.name='admin'));

commit;

select 'parts_landing applied' as status;
