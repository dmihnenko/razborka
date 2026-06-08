-- Public read access to parts companies (seller contacts) for the public
-- parts item page (/public/parts-item/:id).
--
-- Проблема: блок контактов разборки (имя, телефон, адрес) не отображается
-- анонимным посетителям, т.к. RLS закрывает SELECT на public.parts_companies.
-- Публичная страница запчасти запрашивает только бизнес-контакты компании —
-- их и открываем для роли anon (и authenticated).
--
-- Экспонируются только контактные поля, которые и так предназначены для
-- показа покупателю: name, phone, address, email, description.
-- Ограничиваем активными компаниями.

alter table public.parts_companies enable row level security;

drop policy if exists "Public can view active parts companies" on public.parts_companies;

create policy "Public can view active parts companies"
  on public.parts_companies
  for select
  to anon, authenticated
  using (is_active = true);
