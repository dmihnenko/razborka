-- Волна 4: настройки Новой Почты per-разборка (API-ключ + профиль отправителя).
-- Заменяет хранение ключа в localStorage (tsp_np_api_key / tsp_np_config), чтобы НП
-- работала для ВСЕХ сотрудников разборки, а не на одном устройстве/браузере.
--
-- ⚠️ Применять ВРУЧНУЮ в Supabase (SQL editor): prod отстаёт от репо.
-- Вариант хранения B: ключ в таблице с RLS (виден членам своей компании).
-- Для строгой изоляции позже можно перейти на edge-прокси (ключ только на сервере).

create table if not exists public.parts_np_settings (
  parts_company_id        uuid primary key references public.parts_companies(id) on delete cascade,
  api_key                 text,
  -- профиль отправителя (для предзаполнения и создания ТТН)
  sender_counterparty_ref text,
  sender_contact_ref      text,
  sender_city_ref         text,
  sender_city_name        text,
  sender_warehouse_ref    text,
  sender_warehouse_name   text,
  sender_phone            text,
  sender_name             text,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users(id)
);

alter table public.parts_np_settings enable row level security;

-- Изоляция по компании (паттерн репо): доступ только своей parts_company.
drop policy if exists parts_np_settings_select on public.parts_np_settings;
create policy parts_np_settings_select on public.parts_np_settings
  for select to authenticated
  using (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()));

drop policy if exists parts_np_settings_insert on public.parts_np_settings;
create policy parts_np_settings_insert on public.parts_np_settings
  for insert to authenticated
  with check (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()));

drop policy if exists parts_np_settings_update on public.parts_np_settings;
create policy parts_np_settings_update on public.parts_np_settings
  for update to authenticated
  using      (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()))
  with check (parts_company_id in (select parts_company_id from public.user_profiles where id = auth.uid()));

-- Ref документа ТТН в заказе — для трекинга/удаления накладной.
alter table public.parts_orders add column if not exists np_ttn_ref text;
