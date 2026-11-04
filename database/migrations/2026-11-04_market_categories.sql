-- Разделы маркета: глобальный справочник + одно поле на товаре (market_category), разметка триггером по правилам.
-- parts_categories остаётся внутренней категорией кабинета; маркет её больше не читает.
-- Идемпотентна. Применяется вручную. Разовая разметка существующих товаров — отдельным скриптом (см. конец файла).

-- 1. Справочник разделов и правила -----------------------------------------------
create table if not exists public.market_categories (
  slug       text primary key,
  name_ru    text not null,
  name_uk    text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.market_category_rules (
  id       bigint generated always as identity primary key,
  category text not null references public.market_categories(slug) on update cascade on delete cascade,
  pattern  text not null,
  priority int  not null default 50,
  unique (category, pattern)
);

-- 2. Поля товара и кэша -----------------------------------------------------------
alter table public.parts_inventory
  add column if not exists market_category text references public.market_categories(slug)
    on update cascade on delete set null,
  add column if not exists market_category_locked boolean not null default false;

create index if not exists idx_parts_inventory_market_category
  on public.parts_inventory (market_category, created_at desc) where status = 'available';

alter table public.market_facets_cache
  add column if not exists categories jsonb not null default '[]'::jsonb;

-- 3. RLS ----------------------------------------------------------------------------
alter table public.market_categories enable row level security;
alter table public.market_category_rules enable row level security;

drop policy if exists market_categories_public_read on public.market_categories;
create policy market_categories_public_read on public.market_categories
  for select to anon, authenticated using (is_active);

drop policy if exists market_categories_admin_all on public.market_categories;
create policy market_categories_admin_all on public.market_categories
  for all to authenticated
  using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'))
  with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'));

drop policy if exists market_category_rules_admin_all on public.market_category_rules;
create policy market_category_rules_admin_all on public.market_category_rules
  for all to authenticated
  using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'))
  with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and r.name = 'admin'));

grant select on public.market_categories to anon;
grant select, insert, update, delete on public.market_categories to authenticated;
grant select, insert, update, delete on public.market_category_rules to authenticated;

-- 4. Данные: разделы и правила -------------------------------------------------------
-- Правила: регулярные выражения PostgreSQL по lower(name) с ё->е; \m = начало слова.
-- Меньший priority выигрывает (10 узкие сочетания, 20-40 контекст, 50 общие слова).
insert into public.market_categories (slug, name_ru, name_uk, sort_order) values
  ('kuzov', 'Кузов', 'Кузов', 10),
  ('optika', 'Оптика', 'Оптика', 20),
  ('salon', 'Салон', 'Салон', 30),
  ('bezopasnost', 'Безопасность', 'Безпека', 40),
  ('podveska', 'Подвеска и рулевое', 'Підвіска та кермове', 50),
  ('tormoza', 'Тормозная система', 'Гальмівна система', 60),
  ('kolesa', 'Колёса и диски', 'Колеса та диски', 70),
  ('dvigatel', 'Двигатель и трансмиссия', 'Двигун і трансмісія', 80),
  ('batareya', 'Батарея и зарядка', 'Батарея та зарядка', 90),
  ('elektrika', 'Электрика и электроника', 'Електрика та електроніка', 100),
  ('klimat', 'Охлаждение и климат', 'Охолодження та клімат', 110),
  ('vyhlop', 'Выхлоп и топливо', 'Вихлоп і паливо', 120)
on conflict (slug) do update set name_ru = excluded.name_ru, name_uk = excluded.name_uk, sort_order = excluded.sort_order;

insert into public.market_category_rules (category, pattern, priority) values
  ('kuzov', '\mабсорб', 30),
  ('kuzov', '\m(аморт\S*)\s+(\S+\s+)?(капот|багажн)|\m(капот|багажн)\S*\s+(\S+\s+)?аморт', 10),
  ('kuzov', '\mзам(ок|ка|ку|ки)\s+двер|\mручк\S*\s+двер', 10),
  ('kuzov', '\mзеркал\S*\s+заднего\s+вида', 10),
  ('kuzov', '\m(бампер|капот|крыл|крил|двер|багажн|порог|порож|зеркал|дзеркал|стекл|скл[оаеу]|петл|уплотнител|молдинг|четверт|подкрыл|корыт|панорам|лобов|арок\M|удл[ие]нител|[ол]анжерон|лонжерон)', 50),
  ('optika', '\mфонар|\mліхтар|\mптф\M|\mповоротник|\mтуманк', 10),
  ('optika', '\mфар(а|ы|и|у|е|ой|ам|ах)?\M', 40),
  ('salon', '\mкарт(а|и|у|ы|очк\S*)[,\s]+(\S+\s+)?(двер|накладк)', 30),
  ('salon', '\mнакладк\S*\s+(\S+\s+){0,3}(двер|стойк|стоек|колонк)', 30),
  ('salon', '\mобшивк\S*\s+(\S+\s+)?(потол|двер)', 30),
  ('salon', '\m(сиден|сидінн|сидень|торпед|козырек|обшивк|консол|каворлин|ковр|потол|руль\M|руля\M|руле\M|рулю\M)', 50),
  ('bezopasnost', '\mподушк\S*\s+(\S+\s+)?(безопас|безпек)|\mairbag|\mремен\S*\s+безопас|\mремін\S*\s+безпек|\mпреднатяж|\mподушк\S*\s+(руля|ног)|\msrs\M', 10),
  ('bezopasnost', '\mремни\M', 30),
  ('podveska', '\m(пружин|амортизатор|аморт|стойк|стоек|рычаг|важіль|важел|ступиц|сайлент|шаров|подрамник|підрамник|кулак|рейк|рулев|кермов|тяг(а|и|у|е|ой|ам)?\M)', 50),
  ('tormoza', '\m(тормоз|гальм|суппорт|колодк|abs\M|абс\M)', 30),
  ('kolesa', '\m(колпак|ковпак|колес|колісн|диск|шин(а|ы|и|у|ам)?\M|tpms)', 50),
  ('dvigatel', '\m(двигат|двигун|drive\s+unit|редуктор|кпп\M|коробк\S*\s+передач|турбин|грм\M|мотор\M|вакуумн|дроссел|коллектор|зажиган|ресивер|натяжител)', 50),
  ('dvigatel', '\mвпускн|\mмасл', 30),
  ('dvigatel', '\mприводн\S*\s+ремн', 10),
  ('batareya', '\m(bms\M|батаре|аккумулятор|высоковольт|зарядн|charge\s+port|инвертор|контактор|ввб\M|перетворювач|преобразовател)', 10),
  ('elektrika', '\mбодик|\mпарктроник', 10),
  ('elektrika', '\m(динамик|пищалк)|\mмотор\S*\s+стеклоподъем|\mусилител\S*\s+звук', 20),
  ('elektrika', '\m(електро|электро)?проводк|\mджгут|\mблок\S*\s+(управ|модул|комфорт|карт)|\mмодул\S*\s+управ|\mэбу\M', 30),
  ('elektrika', '\mкамер', 40),
  ('elektrika', '\m(контроллер|датчик|дисплей|телевизор|монитор|экран|мцу\M|саб\M|сенсор)', 50),
  ('klimat', '\mтепл\S*\s+насос|\mпаук', 10),
  ('klimat', '\m(кондицион|кондиціон|кондиц|охлажд|охолодж)', 30),
  ('klimat', '\m(радиатор|компрессор|печк|патруб|помп|чиллер|воздуховод)', 50),
  ('vyhlop', '\m(лямбд|кислород|катализатор|глушител)', 10),
  ('vyhlop', '\m(топлив|палив|форсунк)', 30)
on conflict (category, pattern) do update set priority = excluded.priority;

-- 5. Классификатор --------------------------------------------------------------------
create or replace function public.market_category_classify(p_name text)
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select r.category
  from public.market_category_rules r
  join public.market_categories c on c.slug = r.category and c.is_active
  where replace(lower(coalesce(p_name, '')), 'ё', 'е') ~ r.pattern
  order by r.priority, r.id
  limit 1;
$$;

revoke execute on function public.market_category_classify(text) from public, anon;
grant  execute on function public.market_category_classify(text) to authenticated;

-- 6. Триггер разметки ---------------------------------------------------------------------
create or replace function public.parts_inventory_set_market_category()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.market_category_locked then
    return new;                       -- ручной выбор (в т.ч. «Без раздела») не трогаем
  end if;
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and old.market_category_locked = false then
    return new;                       -- имя не менялось и режим уже авто
  end if;
  new.market_category := public.market_category_classify(new.name);
  return new;
end;
$$;

revoke execute on function public.parts_inventory_set_market_category() from public, anon, authenticated;

drop trigger if exists trg_parts_inventory_market_category on public.parts_inventory;
create trigger trg_parts_inventory_market_category
  before insert or update of name, market_category_locked on public.parts_inventory
  for each row execute function public.parts_inventory_set_market_category();

-- 7. Витрина: market_category последней колонкой -------------------------------------------
create or replace view public.market_inventory with (security_invoker = false) as
select pi.id, pi.parts_company_id, pi.category_id, pi.vehicle_id, pi.name, pi.article,
       pi.part_number, pi.description, pi.condition, pi.quantity, pi.reserved_quantity,
       pi.selling_price, pi.price_currency, pi.photo_url, pi.photos, pi.status, pi.created_at,
       pi.part_number_norm, pi.market_category
from public.parts_inventory pi
join public.parts_companies c on c.id = pi.parts_company_id
where pi.status::text = 'available'::text and pi.selling_price > 0::numeric and c.is_active and c.market_published;

grant select on public.market_inventory to anon, authenticated;

-- 8. Фасеты разделов: расчёт, кэш, публичное чтение ------------------------------------------
create or replace function public.compute_market_categories()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', c.slug, 'name_ru', c.name_ru, 'name_uk', c.name_uk, 'count', g.cnt
         ) order by c.sort_order, c.slug), '[]'::jsonb)
  from (select market_category as slug, count(*)::int as cnt
        from public.market_inventory
        where market_category is not null
        group by market_category) g
  join public.market_categories c on c.slug = g.slug and c.is_active
  where g.cnt > 0;
$$;

create or replace function public.refresh_market_car_catalog()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.market_facets_cache (id, data, categories, updated_at)
  values (1, public.compute_market_car_catalog(), public.compute_market_categories(), now())
  on conflict (id) do update
    set data = excluded.data, categories = excluded.categories, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.get_market_categories()
returns json
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select categories from public.market_facets_cache where id = 1),
    public.compute_market_categories()
  )::json;
$$;

revoke execute on function public.compute_market_categories() from public, anon, authenticated;
revoke execute on function public.refresh_market_car_catalog() from public, anon, authenticated;
grant  execute on function public.get_market_categories() to anon, authenticated;

-- 9. Разовая разметка уже существующих товаров и заполнение кэша
update public.parts_inventory
   set market_category = public.market_category_classify(name)
 where market_category_locked = false
   and market_category is distinct from public.market_category_classify(name);
select public.refresh_market_car_catalog();
