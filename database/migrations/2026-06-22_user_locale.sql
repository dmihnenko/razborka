-- i18n: язык интерфейса пользователя (ru/uk) хранится per-user в БД, чтобы выбор
-- переживал устройства/браузеры. Аноним использует localStorage 'tsp_lang'.
-- Пользователь меняет СВОЙ locale — разрешено политикой user_profiles_update (self),
-- триггер guard_user_profile_protected стережёт только parts_company_id/role_id/is_active.
-- Применяется через Management API (ref hwckvddevjucuzxdoqqh).

alter table public.user_profiles add column if not exists locale text not null default 'ru';

do $$ begin
  alter table public.user_profiles add constraint user_profiles_locale_chk check (locale in ('ru', 'uk'));
exception when duplicate_object then null; end $$;
