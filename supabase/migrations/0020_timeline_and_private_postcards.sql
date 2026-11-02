-- Postcard Atlas — the meetup timeline, and private postcards.
--
-- Timeline: the times the group met up, where, with who was there, up to 10
-- photos (one of them the main one) and write-ups: anyone in the group can
-- write about a meetup, signed with their name, and edit or delete their own.
-- Anyone in the group can add a meetup, change its details and add photos. A photo can be removed by whoever added it or by
-- anyone who was at that meetup, so people can take down photos of themselves.
-- A meetup can be deleted by whoever added it.
--
-- Private postcards (#23): cards someone sent to, or got from, people outside
-- the group, just for themselves. Only their owner can ever see them: not the group, not
-- on the map, not in any stats.
--
-- Inbox: a message for each person when a card they sent arrives, when they're
-- added to a meetup, and when they unlock an achievement. Filled by the database
-- itself (triggers and one function), so it works whether or not phone
-- notifications are set up. Only its owner can read it.
--
-- ADDITIVE: new tables, functions, triggers, policies and two new storage buckets.
-- Nothing existing is changed and no data is touched.
-- Run in Supabase → SQL Editor after 0019. Safe to run more than once.

-- ─── Meetups ─────────────────────────────────────────────────────────────────

create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  city text,
  country text,
  country_code text,
  lat double precision,
  lng double precision,
  -- A postcard that mentions it (only ever shown to people who can see that card)
  postcard_id uuid references public.postcards (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meetups_group_id_idx on public.meetups (group_id, starts_on);

create table if not exists public.meetup_members (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (meetup_id, member_id)
);

-- Write-ups: one per person per meetup, signed
create table if not exists public.meetup_notes (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meetup_id, member_id)
);

create table if not exists public.meetup_photos (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  path text not null unique,
  is_main boolean not null default false,
  uploaded_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meetup_photos_meetup_id_idx on public.meetup_photos (meetup_id);
create unique index if not exists meetup_photos_one_main on public.meetup_photos (meetup_id) where is_main;

-- Is this meetup in my group? SECURITY DEFINER so policies don't recurse.
create or replace function public.meetup_in_my_group(p_meetup uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from meetups where id = p_meetup and group_id = my_group_id())
$$;

-- May I remove this photo? I added it, or I was at that meetup.
create or replace function public.can_remove_meetup_photo(p_photo uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from meetup_photos ph
    join meetups m on m.id = ph.meetup_id and m.group_id = my_group_id()
    where ph.id = p_photo
      and (ph.uploaded_by = my_member_id()
           or exists (select 1 from meetup_members mm where mm.meetup_id = m.id and mm.member_id = my_member_id()))
  )
$$;

-- At most 10 photos per meetup.
create or replace function public.meetup_photo_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from meetup_photos where meetup_id = new.meetup_id) >= 10 then
    raise exception 'A meetup can have up to 10 photos';
  end if;
  return new;
end;
$$;

drop trigger if exists meetup_photo_limit on public.meetup_photos;
create trigger meetup_photo_limit before insert on public.meetup_photos
  for each row execute function public.meetup_photo_limit();

alter table public.meetups enable row level security;
alter table public.meetup_members enable row level security;
alter table public.meetup_photos enable row level security;
alter table public.meetup_notes enable row level security;

drop policy if exists "meetups: group reads" on public.meetups;
create policy "meetups: group reads" on public.meetups for select to authenticated
  using (group_id = public.my_group_id());

drop policy if exists "meetups: group adds" on public.meetups;
create policy "meetups: group adds" on public.meetups for insert to authenticated
  with check (group_id = public.my_group_id() and created_by = public.my_member_id());

drop policy if exists "meetups: group edits" on public.meetups;
create policy "meetups: group edits" on public.meetups for update to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id());

drop policy if exists "meetups: creator deletes" on public.meetups;
create policy "meetups: creator deletes" on public.meetups for delete to authenticated
  using (group_id = public.my_group_id() and created_by = public.my_member_id());

drop policy if exists "meetup members: group reads" on public.meetup_members;
create policy "meetup members: group reads" on public.meetup_members for select to authenticated
  using (public.meetup_in_my_group(meetup_id));

drop policy if exists "meetup members: group adds" on public.meetup_members;
create policy "meetup members: group adds" on public.meetup_members for insert to authenticated
  with check (public.meetup_in_my_group(meetup_id)
              and exists (select 1 from public.members m where m.id = member_id and m.group_id = public.my_group_id()));

drop policy if exists "meetup members: group removes" on public.meetup_members;
create policy "meetup members: group removes" on public.meetup_members for delete to authenticated
  using (public.meetup_in_my_group(meetup_id));

drop policy if exists "meetup photos: group reads" on public.meetup_photos;
create policy "meetup photos: group reads" on public.meetup_photos for select to authenticated
  using (public.meetup_in_my_group(meetup_id));

drop policy if exists "meetup photos: group adds" on public.meetup_photos;
create policy "meetup photos: group adds" on public.meetup_photos for insert to authenticated
  with check (public.meetup_in_my_group(meetup_id)
              and uploaded_by = public.my_member_id()
              and path like public.my_group_id()::text || '/' || meetup_id::text || '/%');

-- Choosing the main photo
drop policy if exists "meetup photos: group edits" on public.meetup_photos;
create policy "meetup photos: group edits" on public.meetup_photos for update to authenticated
  using (public.meetup_in_my_group(meetup_id))
  with check (public.meetup_in_my_group(meetup_id));

drop policy if exists "meetup photos: uploader or attendee removes" on public.meetup_photos;
create policy "meetup photos: uploader or attendee removes" on public.meetup_photos for delete to authenticated
  using (public.can_remove_meetup_photo(id));

drop policy if exists "meetup notes: group reads" on public.meetup_notes;
create policy "meetup notes: group reads" on public.meetup_notes for select to authenticated
  using (public.meetup_in_my_group(meetup_id));

drop policy if exists "meetup notes: write your own" on public.meetup_notes;
create policy "meetup notes: write your own" on public.meetup_notes for insert to authenticated
  with check (public.meetup_in_my_group(meetup_id) and member_id = public.my_member_id());

drop policy if exists "meetup notes: edit your own" on public.meetup_notes;
create policy "meetup notes: edit your own" on public.meetup_notes for update to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

drop policy if exists "meetup notes: delete your own" on public.meetup_notes;
create policy "meetup notes: delete your own" on public.meetup_notes for delete to authenticated
  using (member_id = public.my_member_id());

grant select, insert, update, delete on public.meetups, public.meetup_photos, public.meetup_notes to authenticated;
grant select, insert, delete on public.meetup_members to authenticated;
revoke execute on function public.meetup_in_my_group(uuid) from public, anon;
revoke execute on function public.can_remove_meetup_photo(uuid) from public, anon;
grant execute on function public.meetup_in_my_group(uuid) to authenticated;
grant execute on function public.can_remove_meetup_photo(uuid) to authenticated;

-- ─── Storage: private meetups bucket ─────────────────────────────────────────
-- Paths are "<group_id>/<meetup_id>/<random>.jpg".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meetups', 'meetups', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "meetups: group can read photos" on storage.objects;
create policy "meetups: group can read photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'meetups'
         and (storage.foldername(name))[1] = public.my_group_id()::text);

drop policy if exists "meetups: group uploads photos" on storage.objects;
create policy "meetups: group uploads photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meetups'
              and (storage.foldername(name))[1] = public.my_group_id()::text
              and public.meetup_in_my_group(((storage.foldername(name))[2])::uuid));

-- The file goes first, while its photo row still says who may remove it.
drop policy if exists "meetups: uploader or attendee removes photos" on storage.objects;
create policy "meetups: uploader or attendee removes photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meetups'
         and (storage.foldername(name))[1] = public.my_group_id()::text
         and exists (select 1 from public.meetup_photos ph
                     where ph.path = storage.objects.name and public.can_remove_meetup_photo(ph.id)));

-- ─── Private postcards (#23) ─────────────────────────────────────────────────

create table if not exists public.private_postcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null default 'sent' check (direction in ('sent', 'received')),
  -- Who it went to (sent) or came from (received); they don't need an account
  person text not null default '' check (length(person) <= 120),
  -- Where it was posted from
  from_city text,
  from_country text,
  from_country_code text,
  from_lat double precision,
  from_lng double precision,
  sent_on date not null,
  received_on date check (received_on is null or received_on >= sent_on),
  -- What the card says, and notes for yourself
  message text not null default '' check (length(message) <= 4000),
  note text not null default '' check (length(note) <= 4000),
  front_path text,
  back_path text,
  created_at timestamptz not null default now()
);

-- For test databases that ran an earlier draft of this file without it
alter table public.private_postcards add column if not exists message text not null default ''
  check (length(message) <= 4000);

create index if not exists private_postcards_user_id_idx on public.private_postcards (user_id, sent_on);

alter table public.private_postcards enable row level security;

drop policy if exists "private postcards: owner only" on public.private_postcards;
create policy "private postcards: owner only" on public.private_postcards for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.private_postcards to authenticated;

-- Paths are "<user_id>/<card_id>/<side>-<timestamp>.jpg": only the owner's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-postcards', 'private-postcards', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "private postcards: owner reads" on storage.objects;
create policy "private postcards: owner reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'private-postcards' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private postcards: owner uploads" on storage.objects;
create policy "private postcards: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'private-postcards' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "private postcards: owner removes" on storage.objects;
create policy "private postcards: owner removes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'private-postcards' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Inbox ───────────────────────────────────────────────────────────────────

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('arrived', 'achievement', 'meetup')),
  title text not null,
  body text not null default '',
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Binned by its owner (kept, so "Undo" can bring it back)
  deleted_at timestamptz
);

-- For test databases that ran an earlier draft of this file without it
alter table public.inbox_messages add column if not exists deleted_at timestamptz;

create index if not exists inbox_messages_member_idx on public.inbox_messages (member_id, created_at desc);

alter table public.inbox_messages enable row level security;

-- Read your own, and mark them read or binned. Messages are only ever written
-- by the functions below, never directly.
drop policy if exists "inbox: read your own" on public.inbox_messages;
create policy "inbox: read your own" on public.inbox_messages for select to authenticated
  using (member_id = public.my_member_id());

drop policy if exists "inbox: mark your own read" on public.inbox_messages;
create policy "inbox: mark your own read" on public.inbox_messages for update to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id());

grant select, update on public.inbox_messages to authenticated;

-- A card arrived: tell its sender (however it was marked received).
create or replace function public.inbox_card_arrived()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' and new.sender_id is not null then
    insert into inbox_messages (member_id, kind, title, body, link)
    select new.sender_id, 'arrived', 'Your postcard arrived!',
           coalesce(r.display_name, 'Someone') || ' got your card from ' || coalesce(new.from_city, 'your trip') || '.',
           '/postcards/' || new.id
    from (select 1) one
    left join members r on r.id = new.recipient_id;
  end if;
  return new;
end;
$$;

drop trigger if exists inbox_card_arrived on public.postcards;
create trigger inbox_card_arrived after update of status on public.postcards
  for each row execute function public.inbox_card_arrived();

-- Added to a meetup by someone else: tell them.
create or replace function public.inbox_meetup_tagged()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.member_id is distinct from my_member_id() then
    insert into inbox_messages (member_id, kind, title, body, link)
    select new.member_id, 'meetup', 'You were added to a meetup',
           coalesce(adder.display_name, 'Someone') || ' added you to "' || m.title || '" on the timeline.',
           '/timeline/' || m.id
    from meetups m
    left join members adder on adder.id = my_member_id()
    where m.id = new.meetup_id;
  end if;
  return new;
end;
$$;

drop trigger if exists inbox_meetup_tagged on public.meetup_members;
create trigger inbox_meetup_tagged after insert on public.meetup_members
  for each row execute function public.inbox_meetup_tagged();

-- Achievements are worked out by the app, so it reports the ones you have and
-- the database remembers them. New ones get a message; the very first time,
-- what you already had is just remembered (no flood of old news).
create table if not exists public.member_achievements (
  member_id uuid not null references public.members (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  primary key (member_id, achievement_id)
);

alter table public.member_achievements enable row level security;

drop policy if exists "member achievements: read your own" on public.member_achievements;
create policy "member achievements: read your own" on public.member_achievements for select to authenticated
  using (member_id = public.my_member_id());

grant select on public.member_achievements to authenticated;

create or replace function public.record_achievements(p_ids text[], p_names text[])
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me uuid := my_member_id();
  first_time boolean;
begin
  if me is null or p_ids is null then
    return;
  end if;
  first_time := not exists (select 1 from member_achievements where member_id = me);

  if not first_time then
    insert into inbox_messages (member_id, kind, title, body, link)
    select me, 'achievement', 'Achievement unlocked: ' || n.name, 'You earned "' || n.name || '". Nice one!',
           -- Opens the profile with achievements unfolded and this one highlighted
           '/members/' || me || '?achievement=' || n.id || '#unlocked'
    from unnest(p_ids, p_names) as n(id, name)
    where not exists (select 1 from member_achievements a where a.member_id = me and a.achievement_id = n.id);
  end if;

  -- "_checked" marks that the first look happened, even with nothing earned yet
  insert into member_achievements (member_id, achievement_id)
  select me, n.id from unnest(p_ids || array['_checked']) as n(id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.record_achievements(text[], text[]) from public, anon;
grant execute on function public.record_achievements(text[], text[]) to authenticated;
