-- Удаление секретов из parts_companies (колонки читались всеми вошедшими через публичные политики).
-- Данные уже скопированы в parts_company_photo_settings первой миграцией.
-- ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ деплоя клиента, который читает/пишет настройки через RPC
-- get_my_photo_storage / save_my_photo_storage.
-- Перед удалением переносим ключи из старой photo_config, которых нет в новой таблице
-- (приоритет у новой: config = old || current), и создаём строки для недостающих компаний.
do $$
declare has_cfg boolean; has_prov boolean;
begin
  select exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'parts_companies' and column_name = 'photo_config') into has_cfg;
  select exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'parts_companies' and column_name = 'photo_provider') into has_prov;
  if has_cfg then
    execute 'update public.parts_company_photo_settings s '
         || 'set config = coalesce(c.photo_config, ''{}''::jsonb) || s.config '
         || 'from public.parts_companies c '
         || 'where c.id = s.parts_company_id and jsonb_typeof(c.photo_config) = ''object''';
    execute 'insert into public.parts_company_photo_settings (parts_company_id, provider, config) '
         || 'select c.id, ' || case when has_prov then 'c.photo_provider' else 'null' end
         || ', case when jsonb_typeof(c.photo_config) = ''object'' then c.photo_config else ''{}''::jsonb end '
         || 'from public.parts_companies c '
         || 'where not exists (select 1 from public.parts_company_photo_settings x where x.parts_company_id = c.id)';
  end if;
end $$;

alter table public.parts_companies drop column if exists photo_config;
alter table public.parts_companies drop column if exists photo_provider;

-- ПРОВЕРИТЬ после применения:
--  select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'parts_companies'
--     and column_name in ('photo_config','photo_provider');   -- пусто
--  кабинет: Настройки (контакты, хранилище), онбординг, маркет (поставщики) работают.
