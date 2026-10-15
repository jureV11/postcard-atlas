-- Postcard Atlas — retiring old addresses, and keeping postcard history fixed.
--
-- 1. An old address that postcards were sent to can't be deleted (that would
--    break their history). It can now be *retired*: hidden from your list and
--    the address picker, and no longer counted towards the limit of 3 —
--    but still on the map as where those cards went.
-- 2. An address postcards were sent to can only be corrected nearby (25 km),
--    so editing it can't quietly move every card's route to a new home.
-- 3. A helper tells the app which of your addresses are in use, so it can show
--    "Retire" instead of a Delete button that would only fail.
--
-- ADDITIVE ONLY: one new column, functions added or replaced. No data changes.
-- Run in Supabase → SQL Editor after 0012. Safe to run more than once.

alter table public.member_addresses add column if not exists retired_at timestamptz;

-- ─── Limit of 3 counts active (not retired) addresses ────────────────────────

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
  if (select count(*) from member_addresses where member_id = me.id and retired_at is null) >= 3 then
    raise exception 'You can have up to 3 addresses — delete or retire an old one first';
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

-- ─── Editing: only nearby corrections once postcards were sent there ─────────

create or replace function public.km_between(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision
language sql immutable set search_path = public
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.update_address(
  p_id uuid, p_address_line text, p_city text, p_country text, p_country_code text,
  p_lat double precision, p_lng double precision
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  a public.member_addresses;
begin
  select * into a from member_addresses where id = p_id and member_id = my_member_id();
  if not found then raise exception 'You can only edit your own addresses'; end if;
  if exists (select 1 from postcards where recipient_address_id = p_id)
     and km_between(a.lat, a.lng, p_lat, p_lng) > 25 then
    raise exception 'Postcards were sent to this address, so it can only be corrected nearby. Moved? Add your new place as a new address instead.';
  end if;
  update member_addresses set
    address_line = trim(p_address_line), city = p_city, country = p_country,
    country_code = upper(p_country_code), lat = p_lat, lng = p_lng
  where id = p_id;
end;
$$;

-- ─── Delete: unchanged rules, friendlier message ─────────────────────────────

create or replace function public.delete_address(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  a public.member_addresses;
begin
  select * into a from member_addresses where id = p_id and member_id = my_member_id();
  if not found then raise exception 'You can only delete your own addresses'; end if;
  if a.is_current then raise exception 'Make another address current before deleting this one'; end if;
  if exists (select 1 from postcards where recipient_address_id = p_id) then
    raise exception 'Postcards were sent to this address, so it stays as part of their history — retire it instead';
  end if;
  delete from member_addresses where id = p_id;
end;
$$;

-- ─── Retire / bring back ─────────────────────────────────────────────────────

create or replace function public.retire_address(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  a public.member_addresses;
begin
  select * into a from member_addresses where id = p_id and member_id = my_member_id();
  if not found then raise exception 'You can only retire your own addresses'; end if;
  if a.is_current then raise exception 'Make another address current before retiring this one'; end if;
  update member_addresses set retired_at = coalesce(retired_at, now()) where id = p_id;
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
  if (select count(*) from member_addresses where member_id = a.member_id and retired_at is null) >= 3 then
    raise exception 'You already have 3 addresses — retire or delete one first';
  end if;
  update member_addresses set retired_at = null where id = p_id;
end;
$$;

-- A retired address can't become current (bring it back first).
create or replace function public.set_current_address(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me uuid := my_member_id();
begin
  if not exists (select 1 from member_addresses where id = p_id and member_id = me) then
    raise exception 'You can only change your own addresses';
  end if;
  if exists (select 1 from member_addresses where id = p_id and retired_at is not null) then
    raise exception 'Bring this address back before making it current';
  end if;
  update member_addresses set is_current = false where member_id = me and is_current and id <> p_id;
  update member_addresses set is_current = true where id = p_id;
end;
$$;

-- ─── Which of my addresses have postcards linked (yes/no only, no details) ───

create or replace function public.my_addresses_in_use()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct p.recipient_address_id
  from postcards p
  join member_addresses a on a.id = p.recipient_address_id
  where a.member_id = my_member_id()
$$;

revoke execute on function public.km_between(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.retire_address(uuid) from public, anon;
revoke execute on function public.unretire_address(uuid) from public, anon;
revoke execute on function public.my_addresses_in_use() from public, anon;
grant execute on function public.km_between(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.retire_address(uuid) to authenticated;
grant execute on function public.unretire_address(uuid) to authenticated;
grant execute on function public.my_addresses_in_use() to authenticated;
