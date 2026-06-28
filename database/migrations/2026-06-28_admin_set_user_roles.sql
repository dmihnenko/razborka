-- Атомарная смена ролей пользователя админом. Раньше клиент делал delete → upsert
-- двумя запросами: при правке СВОИХ ролей delete снимал admin, и upsert падал с 403
-- (is_admin() уже false) → роли стирались полностью. Теперь всё в одной транзакции,
-- права проверяются ДО удаления, и нельзя снять admin с самого себя.
create or replace function public.admin_set_user_roles(p_user_id uuid, p_role_ids uuid[], p_primary_role_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Только администратор может менять роли' using errcode = 'P0001';
  end if;
  if p_user_id is null then raise exception 'Не указан пользователь' using errcode = 'P0001'; end if;

  -- защита: нельзя снять роль admin с самого себя (иначе потеря доступа, как и случилось)
  if p_user_id = auth.uid()
     and not (coalesce(p_role_ids, '{}') @> array[(select id from public.roles where name = 'admin')]) then
    raise exception 'Нельзя снять роль admin с самого себя' using errcode = 'P0001';
  end if;

  delete from public.user_roles where user_id = p_user_id;
  if array_length(p_role_ids, 1) is not null then
    insert into public.user_roles(user_id, role_id, is_primary)
    select p_user_id, rid, (rid = p_primary_role_id) from unnest(p_role_ids) rid
    on conflict (user_id, role_id) do update set is_primary = excluded.is_primary;
  end if;
end $$;
grant execute on function public.admin_set_user_roles(uuid, uuid[], uuid) to authenticated;
