-- Данные доставки клиента (покупателя) — для предзаполнения заказов маркета.
-- ФИО (full_name) и телефон (phone) уже есть в user_profiles. Добавляем адрес Новой Почты.
-- Храним и человекочитаемое (name/description), и ref'ы НП (для будущего авто-создания ТТН разборкой).

alter table public.user_profiles add column if not exists np_city text;          -- название города
alter table public.user_profiles add column if not exists np_city_ref text;       -- ref города НП
alter table public.user_profiles add column if not exists np_warehouse text;      -- описание отделения
alter table public.user_profiles add column if not exists np_warehouse_ref text;  -- ref отделения НП

-- Запись своих полей доставки/ФИО/телефона разрешена пользователю на СВОЁМ профиле.
-- (Существующий триггер guard_user_profile_protected блокирует смену parts_company_id/role_id/
--  is_active для обычного authenticated, но НЕ трогает эти поля — обычный update проходит по RLS.)
