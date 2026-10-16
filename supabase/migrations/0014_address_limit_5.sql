-- Postcard Atlas — up to 5 active addresses per person (was 3).
--
-- The limit now lives in one function, address_limit(), so changing it later is
-- a one-line edit. Retired addresses still don't count.
--
-- ADDITIVE ONLY: functions added or replaced. No data changes.
-- Run in Supabase → SQL Editor after 0013. Safe to run more than once.

create or replace function public.address_limit()
returns int
language sql immutable set search_path = public
as $$ select 5 $$;

create or replace function public.add_address(
  p_address_line text, p_city text, p_country text, p_country_code text,
  p_lat double precision, p_lng double precision, p_make_current boolean
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  me public.members;
  v_id uuid;
  v_current boolean;
begin
  select * into me from members where user_id = auth.uid();
  if not found then raise exception 'You are not in a group'; end if;
  if (select count(*) from member_addresses where member_id = me.id and retired_at is null) >= address_limit() then
    raise exception 'You can have up to % addresses — delete or retire an old one first', address_limit();
  end if;

  v_current := p_make_current or not exists (select 1 from member_addresses where member_id = me.id);
  if v_current then
    update member_addresses set is_current = false where member_id = me.id and is_current;
  end if;

  insert into member_addresses
    (member_id, group_id, address_line, city, country, country_code, lat, lng, is_current)
  values (me.id, me.group_id, trim(p_address_line), p_city, p_country, upper(p_country_code),
          p_lat, p_lng, v_current)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.unretire_address(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  a public.member_addresses;
begin
  select * into a from member_addresses where id = p_id and member_id = my_member_id();
  if not found then raise exception 'You can only change your own addresses'; end if;
  if a.retired_at is null then return; end if;
  if (select count(*) from member_addresses where member_id = a.member_id and retired_at is null) >= address_limit() then
    raise exception 'You already have % addresses — retire or delete one first', address_limit();
  end if;
  update member_addresses set retired_at = null where id = p_id;
end;
$$;

revoke execute on function public.address_limit() from public, anon;
grant execute on function public.address_limit() to authenticated;
