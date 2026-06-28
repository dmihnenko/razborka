-- Отзывы и рейтинг авторазборок (под фиче-флагом market_reviews).
create table if not exists public.parts_reviews (
  id uuid primary key default gen_random_uuid(),
  parts_company_id uuid not null references public.parts_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz default now(),
  unique (parts_company_id, user_id)
);
create index if not exists idx_parts_reviews_company on public.parts_reviews(parts_company_id, created_at desc);

alter table public.parts_reviews enable row level security;
drop policy if exists pr_select on public.parts_reviews;
create policy pr_select on public.parts_reviews for select
  using (status = 'published' or public.is_admin() or user_id = auth.uid());
drop policy if exists pr_update_own on public.parts_reviews;
create policy pr_update_own on public.parts_reviews for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists pr_delete_own on public.parts_reviews;
create policy pr_delete_own on public.parts_reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.parts_reviews to anon, authenticated;

-- Агрегат рейтинга (для карточек/страницы/SEO)
create or replace function public.get_company_rating(p_company_id uuid)
returns table(avg_rating numeric, review_count int)
language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)::int
  from public.parts_reviews where parts_company_id = p_company_id and status = 'published'
$$;
grant execute on function public.get_company_rating(uuid) to anon, authenticated;

-- Список отзывов с именем автора (только имя — приватность). Definer: anon тоже видит.
create or replace function public.get_company_reviews(p_company_id uuid)
returns table(id uuid, rating int, comment text, created_at timestamptz, author text)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.created_at,
         coalesce(nullif(split_part(coalesce(up.full_name, ''), ' ', 1), ''), 'Покупатель')
  from public.parts_reviews r
  left join public.user_profiles up on up.id = r.user_id
  where r.parts_company_id = p_company_id and r.status = 'published'
  order by r.created_at desc
  limit 50
$$;
grant execute on function public.get_company_reviews(uuid) to anon, authenticated;

-- Добавить/обновить свой отзыв (один на компанию; нельзя на свою компанию).
create or replace function public.add_company_review(p_company_id uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти' using errcode = 'P0001'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Оценка 1–5' using errcode = 'P0001'; end if;
  if p_company_id = public.my_parts_company_id() then
    raise exception 'Нельзя оставить отзыв своей разборке' using errcode = 'P0001';
  end if;
  insert into public.parts_reviews(parts_company_id, user_id, rating, comment)
    values (p_company_id, auth.uid(), p_rating, nullif(trim(p_comment), ''))
  on conflict (parts_company_id, user_id)
    do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end $$;
grant execute on function public.add_company_review(uuid, int, text) to authenticated;
