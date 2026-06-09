-- Корзина пользователей: мягкое удаление + восстановление.
-- deleted_at = NULL — активная запись; не NULL — в корзине (скрыта из списков).

alter table public.user_profiles
  add column if not exists deleted_at timestamptz;

create index if not exists idx_user_profiles_deleted_at
  on public.user_profiles (deleted_at);
