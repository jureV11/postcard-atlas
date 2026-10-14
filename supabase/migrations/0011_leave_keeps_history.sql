-- Postcard Atlas — leaving a group keeps your postcards in its history.
--
-- A leaver's member row stays (name, colour, home, every postcard) and shows as
-- "(former member)". Their account is detached from it so they can join or start
-- another group; if they ever rejoin the same group they get the old row back.
-- The group owner role passes to the longest-standing remaining member.
--
-- ADDITIVE ONLY: new columns, user_id made optional, functions replaced.
-- No rows are deleted, no data columns dropped or renamed.
-- Run in Supabase → SQL Editor after 0010. Safe to run more than once.

-- ─── New columns ─────────────────────────────────────────────────────────────

alter table public.members add column if not exists left_at timestamptz;
alter table public.members
  add column if not exists former_user_id uuid references auth.users (id) on delete set null;
-- A former member has no current account; still one active membership per account
-- (the existing unique constraint on user_id allows many empty values).
alter table public.members alter column user_id drop not null;

alter table public.groups
  add column if not exists owner_member_id uuid references public.members (id) on delete set null;

-- Owner for existing groups: whoever created it, else the longest-standing member.
update public.groups g
set owner_member_id = m.id
from public.members m
where g.owner_member_id is null and m.group_id = g.id and m.user_id = g.created_by;

update public.groups g
set owner_member_id = (
  select m.id from public.members m where m.group_id = g.id order by m.created_at limit 1
)
where g.owner_member_id is null;

-- ─── Leave ───────────────────────────────────────────────────────────────────

create or replace function public.leave_group()
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me public.members;
begin
  select * into me from members where user_id = auth.uid();
  if not found then
    raise exception 'You are not in a group';
  end if;

  -- Keep the row (and every postcard) — just detach the account.
  update members
  set left_at = now(), former_user_id = user_id, user_id = null
  where id = me.id;

  -- Owner leaving: hand over to the longest-standing remaining member
  -- (nobody left → no owner until someone joins).
  update groups
  set owner_member_id = (
    select id from members
    where group_id = me.group_id and left_at is null
    order by created_at limit 1
  )
  where id = me.group_id and owner_member_id = me.id;
end;
$$;

-- ─── Create (now records the owner) ──────────────────────────────────────────

create or replace function public.create_group(
  p_group_name        text,
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
  v_code   text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'You are already in a group';
  end if;

  loop
    v_code := gen_invite_code();
    exit when not exists (select 1 from groups where invite_code = v_code);
  end loop;

  insert into groups (name, invite_code, created_by)
  values (trim(p_group_name), v_code, auth.uid())
  returning id into v_group;

  insert into members (group_id, user_id, display_name, color, home_city, home_country,
                       home_country_code, home_lat, home_lng)
  values (v_group, auth.uid(), trim(p_display_name), lower(p_color), p_home_city, p_home_country,
          upper(p_home_country_code), p_home_lat, p_home_lng)
  returning id into v_member;

  update groups set owner_member_id = v_member where id = v_group;
  return v_group;
end;
$$;

-- ─── Join (rejoining brings your old profile and postcards back) ─────────────

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

  -- Coming back? Reactivate your old row: same colour, same postcards.
  select id into v_member
  from members
  where group_id = v_group and former_user_id = auth.uid()
  order by left_at desc nulls last
  limit 1;

  if v_member is not null then
    update members set
      user_id = auth.uid(),
      former_user_id = null,
      left_at = null,
      display_name = trim(p_display_name),
      home_city = p_home_city,
      home_country = p_home_country,
      home_country_code = upper(p_home_country_code),
      home_lat = p_home_lat,
      home_lng = p_home_lng
    where id = v_member;
  else
    if (select count(*) from members where group_id = v_group and left_at is null) >= 12 then
      raise exception 'This group is full';
    end if;
    -- Former members keep their colour, so it stays taken.
    if exists (select 1 from members where group_id = v_group and color = lower(p_color)) then
      raise exception 'That colour is already taken — pick another';
    end if;

    insert into members (group_id, user_id, display_name, color, home_city, home_country,
                         home_country_code, home_lat, home_lng)
    values (v_group, auth.uid(), trim(p_display_name), lower(p_color), p_home_city, p_home_country,
            upper(p_home_country_code), p_home_lat, p_home_lng)
    returning id into v_member;
  end if;

  -- A group everyone had left gets a new owner.
  update groups set owner_member_id = v_member where id = v_group and owner_member_id is null;
  return v_group;
end;
$$;

-- ─── Preview (active members only; tells you if you're rejoining) ────────────
-- The return columns change, so the old version has to be replaced, not altered.

drop function if exists public.group_preview(text);

create function public.group_preview(p_code text)
returns table (group_name text, member_names text[], taken_colors text[], rejoining boolean)
language sql stable security definer set search_path = public
as $$
  select g.name,
         coalesce(array_agg(m.display_name order by m.created_at) filter (where m.id is not null and m.left_at is null), '{}'),
         coalesce(array_agg(m.color) filter (where m.id is not null), '{}'),
         coalesce(bool_or(m.former_user_id = auth.uid()), false)
  from groups g
  left join members m on m.group_id = g.id
  where g.invite_code = upper(trim(p_code))
  group by g.id, g.name
$$;

revoke execute on function public.group_preview(text) from public, anon;
grant execute on function public.group_preview(text) to authenticated;
revoke execute on function public.leave_group() from public, anon;
grant execute on function public.leave_group() to authenticated;
