-- Per-разборка выбор курса: 'auto' (глобальный ПриватБанк-курс из app_settings) или 'manual' (свой).
-- Анти-спам сохранён: 'auto' читает глобальный крон-курс; 'manual' — просто сохранённое значение.
-- Никаких пользовательских запросов к ПриватБанку.

alter table public.parts_companies add column if not exists usd_rate_mode text not null default 'auto'; -- 'auto' | 'manual'
alter table public.parts_companies add column if not exists usd_rate numeric;                            -- ручной курс (при mode='manual')

-- Владелец/админ задаёт режим и (для manual) свой курс своей компании.
create or replace function public.set_company_rate(p_mode text, p_rate numeric default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company uuid;
begin
  if not (public.is_parts_owner() or public.is_admin()) then
    raise exception 'forbidden';
  end if;
  v_company := public.my_parts_company_id();
  if v_company is null then
    raise exception 'no parts company';
  end if;
  if p_mode = 'manual' then
    if p_rate is null or p_rate <= 0 or p_rate > 1000 then raise exception 'invalid rate'; end if;
    update public.parts_companies set usd_rate_mode = 'manual', usd_rate = p_rate where id = v_company;
  else
    update public.parts_companies set usd_rate_mode = 'auto' where id = v_company; -- свой курс сохраняем (можно вернуться)
  end if;
end;
$$;
revoke all on function public.set_company_rate(text, numeric) from public;
grant execute on function public.set_company_rate(text, numeric) to authenticated;
