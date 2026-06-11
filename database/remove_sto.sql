-- ============================================================================
-- TSP V2 — удаление функционала СТО из базы данных (Supabase / Postgres)
-- ============================================================================
--
-- СТАТУС: ПРИМЕНЕНО 2026-06-12 к проекту tsp.pp.ua (ref hwckvddevjucuzxdoqqh)
--         через Supabase Management API. Бэкап СТО-данных сохранён локально
--         (C:\Users\home\tsp_sto_backup_2026-06-12, 14 таблиц + users + общие строки).
--
-- ⚠️  Этот файл — точная запись применённой миграции. Если запускать повторно
--     на другой среде: СНАЧАЛА БЭКАП, затем выполнять блоками по порядку.
--     Объекты защищены IF EXISTS, но порядок важен (политики → таблицы → строки
--     → колонки → триггеры/функции), иначе зависимости заблокируют DROP.
--
-- Контекст: СТО вынесен в отдельный проект. Здесь остаются Разборка (parts_*) и
-- Мои авто (personal_vehicles). Целевой проект — ТОЛЬКО hwckvddevjucuzxdoqqh.
-- ⚠️  Проект autocrm (fclmzfoxssbiljpgybpo) — ЧУЖОЙ, трогать нельзя.
-- ============================================================================

-- ── БЛОК A — RLS-политики на СОХРАНЯЕМЫХ таблицах ───────────────────────────
-- Комбинированные политники (sto+parts) переписываем на parts-only через ALTER
-- (сохраняет cmd/roles); чисто-СТО политики удаляем. Делать ДО дропа таблиц,
-- иначе CASCADE снесёт комбинированные политики целиком.
begin;
alter policy "subreq_select" on subscription_requests using (
  (exists (select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='admin'))
  or ((company_type)::text='parts' and company_id in (select parts_company_id from user_profiles where id=auth.uid()))
);
alter policy "subreq_insert" on subscription_requests with check (
  ((company_type)::text='parts' and company_id in (select parts_company_id from user_profiles where id=auth.uid()))
  or (exists (select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='admin'))
);
alter policy "Owners update worker requests" on access_requests using (
  (request_type='parts_worker') and exists (
    select 1 from user_profiles up join parts_companies pc on pc.id=up.parts_company_id
    where up.id=auth.uid() and (pc.phone)::text=access_requests.owner_phone)
);
drop policy if exists "STO members can view their logs" on activity_logs;
drop policy if exists "STO owners see worker requests" on access_requests;

-- ── БЛОК B — СТО-таблицы (CASCADE снимет их политики/FK/триггеры) ───────────
drop table if exists appointment_parts cascade;
drop table if exists appointment_services cascade;
drop table if exists appointment_comments cascade;
drop table if exists work_order_items cascade;
drop table if exists sto_invoices cascade;
drop table if exists invoices cascade;
drop table if exists appointments cascade;
drop table if exists work_orders cascade;
drop table if exists services cascade;
drop table if exists service_categories cascade;
drop table if exists parts cascade;          -- legacy склад запчастей СТО (НЕ parts_inventory)
drop table if exists vehicles cascade;        -- авто СТО (у разборки свои parts_vehicles)
drop table if exists customers cascade;       -- клиенты СТО (у разборки свои parts_customers)
drop table if exists sto_companies cascade;

-- ── БЛОК C — СТО-строки в общих таблицах + СТО/магазин роли ─────────────────
delete from company_subscriptions where company_type='sto';
delete from subscriptions where company_type='sto';
delete from access_requests where request_type in ('sto_owner','sto_worker','store_owner','store_worker');
delete from user_roles where role_id in (select id from roles where name in ('sto_owner','sto_worker','store_owner','store_worker'));
delete from roles where name in ('sto_owner','sto_worker','store_owner','store_worker');

-- ── БЛОК D — снятие СТО-колонок с общих таблиц ─────────────────────────────
alter table user_profiles drop column if exists sto_company_id;
alter table trash_bin     drop column if exists sto_company_id;
alter table activity_logs drop column if exists sto_company_id;
alter table users         drop column if exists sto_company_id;  -- legacy users-таблица
commit;

-- ── БЛОК E — СТО-триггеры на сохраняемых таблицах + осиротевшие функции ─────
-- Триггеры reassign на user_profiles дёргали удалённые appointments — снять
-- обязательно (иначе любое обновление профиля → ошибка).
begin;
drop trigger if exists trigger_reassign_on_worker_deactivation on user_profiles;
drop trigger if exists trigger_reassign_on_worker_deletion on user_profiles;
drop function if exists reassign_appointments_on_worker_deactivation();
drop function if exists reassign_appointments_on_worker_deletion();
drop function if exists auto_assign_to_single_worker();
drop function if exists log_appointment_change();
drop function if exists log_customer_change();
drop function if exists update_work_order_total();
drop function if exists generate_invoice_number(uuid);
drop function if exists get_public_invoice(text);

-- create_user_account: убрать запись в users.sto_company_id (колонки нет),
-- сигнатуру оставить прежней (parts-создание пользователей не ломаем).
create or replace function public.create_user_account(
  p_email text, p_password text, p_full_name text, p_phone text,
  p_role_ids uuid[], p_primary_role_id uuid,
  p_sto_company_id uuid default null::uuid,
  p_parts_company_id uuid default null::uuid,
  p_username text default null::text)
returns json language plpgsql security definer as $function$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_is_admin boolean;
begin
  select exists (
    select 1 from public.user_roles ur join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid() and r.name = 'admin'
  ) into v_is_admin;
  if not v_is_admin then
    return json_build_object('success', false, 'error', 'Access denied');
  end if;
  v_user_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone),
    now(), now(), '', '', '', ''
  );
  insert into public.users (
    id, email, full_name, phone, primary_role_id, parts_company_id, username, plain_password
  ) values (
    v_user_id, p_email, p_full_name, p_phone, p_primary_role_id, p_parts_company_id, p_username, p_password
  );
  foreach v_role_id in array p_role_ids loop
    insert into public.user_roles (user_id, role_id) values (v_user_id, v_role_id);
  end loop;
  return json_build_object('success', true, 'user_id', v_user_id);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end;
$function$;
commit;

-- ============================================================================
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ (всё должно быть пусто / только parts-роли):
--   - information_schema.tables: СТО-таблиц нет
--   - information_schema.columns where column_name='sto_company_id': пусто
--   - pg_policies: нет ссылок на sto_company/sto_owner/sto_worker
--   - roles: admin, parts_owner, parts_worker, user
-- ============================================================================
