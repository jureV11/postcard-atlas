-- Postcard Atlas — step 1: groups, members, avatars
-- Run in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- One membership per user: each person belongs to exactly one group.
create table public.members (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references public.groups (id) on delete cascade,
  user_id           uuid not null unique references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 1 and 40),
  avatar_path       text,
  color             text not null check (color ~ '^#[0-9a-f]{6}$'),
  home_city         text not null,
  home_country      text not null,
  home_country_code char(2) not null,
  home_lat          double precision not null check (home_lat between -90 and 90),
  home_lng          double precision not null check (home_lng between -180 and 180),
  created_at        timestamptz not null default now(),
  unique (group_id, color)
);

create index members_group_id_idx on public.members (group_id);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- The current user's group. SECURITY DEFINER so RLS policies can call it
-- without recursing into the members policy.
create or replace function public.my_group_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select group_id from public.members where user_id = auth.uid()
$$;

create or replace function public.gen_invite_code()
returns text
language plpgsql volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text := '';
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.groups  enable row level security;
alter table public.members enable row level security;

create policy "groups: members can read their group"
  on public.groups for select to authenticated
  using (id = public.my_group_id());

create policy "members: read own group"
  on public.members for select to authenticated
  using (group_id = public.my_group_id());

create policy "members: update self"
  on public.members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts happen only through the RPCs below. Updates are limited to profile columns.
revoke insert, update, delete on public.groups  from anon, authenticated;
revoke insert, update, delete on public.members from anon, authenticated;
grant update (display_name, avatar_path, color, home_city, home_country,
              home_country_code, home_lat, home_lng)
  on public.members to authenticated;

-- ─── RPCs: create / preview / join ───────────────────────────────────────────

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
  v_group uuid;
  v_code  text;
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
          upper(p_home_country_code), p_home_lat, p_home_lng);

  return v_group;
end;
$$;

-- Lets someone holding an invite code see who they're about to join.
create or replace function public.group_preview(p_code text)
returns table (group_name text, member_names text[], taken_colors text[])
language sql stable security definer set search_path = public
as $$
  select g.name,
         coalesce(array_agg(m.display_name order by m.created_at) filter (where m.id is not null), '{}'),
         coalesce(array_agg(m.color) filter (where m.id is not null), '{}')
  from groups g
  left join members m on m.group_id = g.id
  where g.invite_code = upper(trim(p_code))
  group by g.id, g.name
$$;

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
  v_group uuid;
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
  if (select count(*) from members where group_id = v_group) >= 12 then
    raise exception 'This group is full';
  end if;
  if exists (select 1 from members where group_id = v_group and color = lower(p_color)) then
    raise exception 'That colour is already taken — pick another';
  end if;

  insert into members (group_id, user_id, display_name, color, home_city, home_country,
                       home_country_code, home_lat, home_lng)
  values (v_group, auth.uid(), trim(p_display_name), lower(p_color), p_home_city, p_home_country,
          upper(p_home_country_code), p_home_lat, p_home_lng);

  return v_group;
end;
$$;

revoke execute on function public.create_group(text, text, text, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.join_group(text, text, text, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.group_preview(text) from public, anon;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;
grant execute on function public.create_group(text, text, text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.join_group(text, text, text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.group_preview(text) to authenticated;

-- ─── Storage: private avatars bucket ─────────────────────────────────────────
-- Object paths are "<group_id>/<user_id>/<file>". Group members can read;
-- each user can only write inside their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: group can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = public.my_group_id()::text);

create policy "avatars: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = public.my_group_id()::text
              and (storage.foldername(name))[2] = auth.uid()::text);

create policy "avatars: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = public.my_group_id()::text
         and (storage.foldername(name))[2] = auth.uid()::text);
