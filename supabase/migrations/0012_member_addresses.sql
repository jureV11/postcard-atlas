-- Postcard Atlas — several addresses per member, and every postcard linked to
-- the address it was actually sent to.
--
-- ADDITIVE ONLY: a new table and a new column, filled from existing data.
-- members.home_* stay and are kept in sync with each member's current address.
-- No rows are deleted, no data columns dropped or renamed.
-- Run in Supabase → SQL Editor after 0011. Safe to run more than once.

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.member_addresses (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  group_id     uuid not null references public.groups (id) on delete cascade,
  address_line text not null check (char_length(address_line) between 1 and 300),
  city         text not null,
  country      text not null,
  country_code char(2) not null,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  is_current   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists member_addresses_member_idx on public.member_addresses (member_id);
-- Exactly one current address per member (enforced: at most one).
create unique index if not exists member_addresses_one_current
  on public.member_addresses (member_id) where is_current;

-- Group members can read each other's addresses; nobody else can. Writes only
-- through the functions below (which check you're editing your own).
alter table public.member_addresses enable row level security;
revoke all on public.member_addresses from anon, authenticated;
grant select on public.member_addresses to authenticated;
drop policy if exists "addresses: group can read" on public.member_addresses;
create policy "addresses: group can read"
  on public.member_addresses for select to authenticated
  using (group_id = public.my_group_id());

-- ─── Postcards remember the address they were sent to ────────────────────────

alter table public.postcards
  add column if not exists recipient_address_id uuid references public.member_addresses (id);

-- ─── Backfill from existing data ─────────────────────────────────────────────
-- One current address per member = their existing home city (same coordinates,
-- so no distance changes)…
insert into public.member_addresses
  (member_id, group_id, address_line, city, country, country_code, lat, lng, is_current)
select m.id, m.group_id, m.home_city || ', ' || m.home_country, m.home_city, m.home_country,
       upper(m.home_country_code), m.home_lat, m.home_lng, true
from public.members m
where not exists (select 1 from public.member_addresses a where a.member_id = m.id);

-- …and every existing postcard points at its recipient's address.
update public.postcards p
set recipient_address_id = a.id
from public.member_addresses a
where p.recipient_address_id is null and a.member_id = p.recipient_id and a.is_current;

-- ─── Keep things consistent automatically ────────────────────────────────────

-- The current address is mirrored into members.home_* (home pins, home-country
-- colours and stats keep working unchanged).
create or replace function public.sync_home_from_address()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_current then
    update members set
      home_city = new.city,
      home_country = new.country,
      home_country_code = upper(new.country_code),
      home_lat = new.lat,
      home_lng = new.lng
    where id = new.member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists member_addresses_sync_home on public.member_addresses;
create trigger member_addresses_sync_home
  after insert or update on public.member_addresses
  for each row execute function public.sync_home_from_address();

-- New members (creating/joining a group) get their home city as first address.
create or replace function public.create_first_address()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from member_addresses where member_id = new.id) then
    insert into member_addresses
      (member_id, group_id, address_line, city, country, country_code, lat, lng, is_current)
    values (new.id, new.group_id, new.home_city || ', ' || new.home_country, new.home_city,
            new.home_country, upper(new.home_country_code), new.home_lat, new.home_lng, true);
  end if;
  return new;
end;
$$;

drop trigger if exists members_first_address on public.members;
create trigger members_first_address
  after insert on public.members
  for each row execute function public.create_first_address();

-- A card always points at one of its recipient's addresses: their current one
-- unless a specific (older) one was chosen. Changing the recipient resets it.
create or replace function public.default_postcard_address()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.recipient_address_id is null or not exists (
    select 1 from member_addresses a
    where a.id = new.recipient_address_id and a.member_id = new.recipient_id
  ) then
    select id into new.recipient_address_id
    from member_addresses
    where member_id = new.recipient_id and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists postcards_default_address on public.postcards;
create trigger postcards_default_address
  before insert or update of recipient_id, recipient_address_id on public.postcards
  for each row execute function public.default_postcard_address();

-- Home is now edited through addresses only (keeps the two in sync).
revoke update (home_city, home_country, home_country_code, home_lat, home_lng)
  on public.members from authenticated;

-- ─── Address functions (your own addresses only) ─────────────────────────────

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
  if (select count(*) from member_addresses where member_id = me.id) >= 3 then
    raise exception 'You can have up to 3 addresses — delete an old one first';
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

-- Editing an address moves every card sent to it (distances follow).
create or replace function public.update_address(
  p_id uuid, p_address_line text, p_city text, p_country text, p_country_code text,
  p_lat double precision, p_lng double precision
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update member_addresses set
    address_line = trim(p_address_line), city = p_city, country = p_country,
    country_code = upper(p_country_code), lat = p_lat, lng = p_lng
  where id = p_id and member_id = my_member_id();
  if not found then raise exception 'You can only edit your own addresses'; end if;
end;
$$;

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
  update member_addresses set is_current = false where member_id = me and is_current and id <> p_id;
  update member_addresses set is_current = true where id = p_id;
end;
$$;

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
    raise exception 'Postcards were sent to this address, so it stays as part of their history';
  end if;
  delete from member_addresses where id = p_id;
end;
$$;

-- Which of the recipient's addresses a card went to (sender or recipient may change it).
create or replace function public.set_postcard_address(p_id uuid, p_address_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
  me uuid := my_member_id();
begin
  select * into card from postcards where id = p_id;
  if not found or me is null or me not in (card.sender_id, card.recipient_id) then
    raise exception 'Only the sender or recipient can change where this postcard went';
  end if;
  if not exists (select 1 from member_addresses where id = p_address_id and member_id = card.recipient_id) then
    raise exception 'That isn''t one of the recipient''s addresses';
  end if;
  update postcards set recipient_address_id = p_address_id where id = p_id;
end;
$$;

revoke execute on function public.add_address(text, text, text, text, double precision, double precision, boolean) from public, anon;
revoke execute on function public.update_address(uuid, text, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.set_current_address(uuid) from public, anon;
revoke execute on function public.delete_address(uuid) from public, anon;
revoke execute on function public.set_postcard_address(uuid, uuid) from public, anon;
grant execute on function public.add_address(text, text, text, text, double precision, double precision, boolean) to authenticated;
grant execute on function public.update_address(uuid, text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.set_current_address(uuid) to authenticated;
grant execute on function public.delete_address(uuid) to authenticated;
grant execute on function public.set_postcard_address(uuid, uuid) to authenticated;

-- ─── Rejoining keeps your old addresses (don't overwrite home from the form) ─

create or replace function public.join_group(
  p_code              text,
  p_display_name      text,
  p_color             text,
  p_home_city         text,
  p_home_country      text,
  p_home_country_code text,
  p_home_lat          double precision,
  p_home_lng          double precision
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_group  uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'You are already in a group';
  end if;

  select id into v_group from groups where invite_code = upper(trim(p_code));
  if v_group is null then
    raise exception 'No group found with that invite code';
  end if;

  select id into v_member
  from members
  where group_id = v_group and former_user_id = auth.uid()
  order by left_at desc nulls last
  limit 1;

  if v_member is not null then
    -- Welcome back: same colour, postcards and addresses (manage them on the map page).
    update members set
      user_id = auth.uid(),
      former_user_id = null,
      left_at = null,
      display_name = trim(p_display_name)
    where id = v_member;
  else
    if (select count(*) from members where group_id = v_group and left_at is null) >= 12 then
      raise exception 'This group is full';
    end if;
    if exists (select 1 from members where group_id = v_group and color = lower(p_color)) then
      raise exception 'That colour is already taken — pick another';
    end if;

    insert into members (group_id, user_id, display_name, color, home_city, home_country,
                         home_country_code, home_lat, home_lng)
    values (v_group, auth.uid(), trim(p_display_name), lower(p_color), p_home_city, p_home_country,
            upper(p_home_country_code), p_home_lat, p_home_lng)
    returning id into v_member;
  end if;

  update groups set owner_member_id = v_member where id = v_group and owner_member_id is null;
  return v_group;
end;
$$;

-- ─── The postcard view now includes where each card went ────────────────────
-- (A view, not data — rebuilt with the same rules as 0009 plus the address.)

drop view if exists public.postcard_feed;

create view public.postcard_feed as
select
  p.id, p.group_id, p.sender_id, p.recipient_id,
  p.from_city, p.from_country, p.from_country_code, p.from_lat, p.from_lng,
  p.sent_on, p.received_on, p.status, p.created_at,
  true as revealed,
  p.front_path, p.back_path, p.message, p.note,
  p.front_path is not null as has_front,
  p.back_path  is not null as has_back,
  p.message    is not null as has_message,
  v.is_public,
  p.recipient_address_id,
  a.address_line as to_address_line,
  a.city         as to_city,
  a.country      as to_country,
  a.country_code as to_country_code,
  a.lat          as to_lat,
  a.lng          as to_lng
from public.postcards p
left join public.member_addresses a on a.id = p.recipient_address_id
cross join lateral (select public.postcard_is_public(p.id) as is_public) v
where p.group_id = public.my_group_id()
  and (
    p.sender_id = public.my_member_id()
    or (p.recipient_id = public.my_member_id() and p.status = 'received')
    or v.is_public
  );

revoke all on public.postcard_feed from anon, authenticated;
grant select on public.postcard_feed to authenticated;
