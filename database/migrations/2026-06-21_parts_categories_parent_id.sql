-- Подкатегории: parts_categories.parent_id (само-ссылка). Код давно умеет
-- подкатегории (handleAddSub, c.parent_id === parentId, createPartsCategoriesBulk
-- с parentId), но колонки не было → INSERT с parent_id падал с 400.
-- ON DELETE CASCADE: удаление родителя убирает подкатегории.
alter table public.parts_categories
  add column if not exists parent_id uuid references public.parts_categories(id) on delete cascade;

create index if not exists idx_parts_categories_parent on public.parts_categories(parent_id);
