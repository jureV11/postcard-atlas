-- Postcard Atlas — reactions and comments on postcards.
--
-- Anyone who can see a postcard can react to it (a few fixed emoji, one of each
-- per person) and comment on it. A comment lands in the inbox of the card's
-- sender and recipient, and of whoever else has commented on it.
--
-- KEEPING SURPRISES SAFE: reactions and comments follow exactly the same rule as
-- the card itself (the postcard_feed view): its sender always, its recipient once
-- it has arrived, everyone once it's public. A card still in the post can't be
-- reacted to or commented on at all, so nothing about it can show up anywhere.
--
-- ADDITIVE: two new tables, three new functions, and the inbox's list of message
-- kinds gets 'comment' (every existing message still fits). No data is changed.
-- Run in Supabase → SQL Editor after 0023. Safe to run more than once.

-- ─── Who can see a card ──────────────────────────────────────────────────────

-- The postcard_feed rule, for any member (the view only answers for "me").
create or replace function public.postcard_visible_to(p_id uuid, p_member uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select p.group_id = m.group_id and (
      p.sender_id = m.id
      or (p.recipient_id = m.id and p.status = 'received')
      or public.postcard_is_public(p.id)
    )
    from postcards p, members m
    where p.id = p_id and m.id = p_member
  ), false)
$$;

-- Reacting and commenting: you can see it, and it's out of the post (arrived or lost).
create or replace function public.postcard_open_for_chat(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.postcard_visible_to(p_id, public.my_member_id())
     and exists (select 1 from postcards where id = p_id and status in ('received', 'lost'))
$$;

revoke execute on function public.postcard_visible_to(uuid, uuid) from public, anon;
revoke execute on function public.postcard_open_for_chat(uuid) from public, anon;
grant execute on function public.postcard_visible_to(uuid, uuid) to authenticated;
grant execute on function public.postcard_open_for_chat(uuid) to authenticated;

-- ─── Reactions ───────────────────────────────────────────────────────────────

create table if not exists public.postcard_reactions (
  postcard_id uuid not null references public.postcards (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😍', '😂', '🤯', '🔥', '👏')),
  created_at timestamptz not null default now(),
  primary key (postcard_id, member_id, emoji)
);

alter table public.postcard_reactions enable row level security;

drop policy if exists "postcard reactions: read if you see the card" on public.postcard_reactions;
create policy "postcard reactions: read if you see the card" on public.postcard_reactions for select to authenticated
  using (public.postcard_visible_to(postcard_id, public.my_member_id()));

drop policy if exists "postcard reactions: add your own" on public.postcard_reactions;
create policy "postcard reactions: add your own" on public.postcard_reactions for insert to authenticated
  with check (member_id = public.my_member_id() and public.postcard_open_for_chat(postcard_id));

drop policy if exists "postcard reactions: remove your own" on public.postcard_reactions;
create policy "postcard reactions: remove your own" on public.postcard_reactions for delete to authenticated
  using (member_id = public.my_member_id());

grant select, insert, delete on public.postcard_reactions to authenticated;

-- ─── Comments ────────────────────────────────────────────────────────────────

create table if not exists public.postcard_comments (
  id uuid primary key default gen_random_uuid(),
  postcard_id uuid not null references public.postcards (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists postcard_comments_postcard_idx on public.postcard_comments (postcard_id, created_at);

alter table public.postcard_comments enable row level security;

drop policy if exists "postcard comments: read if you see the card" on public.postcard_comments;
create policy "postcard comments: read if you see the card" on public.postcard_comments for select to authenticated
  using (public.postcard_visible_to(postcard_id, public.my_member_id()));

drop policy if exists "postcard comments: write your own" on public.postcard_comments;
create policy "postcard comments: write your own" on public.postcard_comments for insert to authenticated
  with check (member_id = public.my_member_id() and public.postcard_open_for_chat(postcard_id));

drop policy if exists "postcard comments: edit your own" on public.postcard_comments;
create policy "postcard comments: edit your own" on public.postcard_comments for update to authenticated
  using (member_id = public.my_member_id())
  with check (member_id = public.my_member_id() and public.postcard_open_for_chat(postcard_id));

drop policy if exists "postcard comments: delete your own" on public.postcard_comments;
create policy "postcard comments: delete your own" on public.postcard_comments for delete to authenticated
  using (member_id = public.my_member_id());

grant select, insert, update, delete on public.postcard_comments to authenticated;

-- ─── Inbox: "new comment" ────────────────────────────────────────────────────

-- The kind check was written inline in 0020, so Postgres picked its name:
-- replace every check on inbox_messages that limits the kind.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inbox_messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.inbox_messages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.inbox_messages add constraint inbox_messages_kind_check
  check (kind in ('arrived', 'achievement', 'meetup', 'comment'));

-- Tell the card's sender, its recipient and earlier commenters (not whoever is
-- writing), but only people still in the group who can see the card.
create or replace function public.inbox_postcard_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into inbox_messages (member_id, kind, title, body, link)
  select t.id, 'comment',
         'New comment on the card from ' || coalesce(p.from_city, 'a trip'),
         coalesce(w.display_name, 'Someone') || ': “' ||
           case when length(new.body) > 140 then left(new.body, 140) || '…' else new.body end || '”',
         '/postcards/' || p.id || '#comments'
  from postcards p
  left join members w on w.id = new.member_id
  cross join lateral (
    select p.sender_id as id
    union select p.recipient_id
    union select c.member_id from postcard_comments c where c.postcard_id = p.id
  ) t
  join members tm on tm.id = t.id and tm.left_at is null
  where p.id = new.postcard_id
    and t.id <> new.member_id
    and public.postcard_visible_to(p.id, t.id);
  return new;
end;
$$;

drop trigger if exists inbox_postcard_comment on public.postcard_comments;
create trigger inbox_postcard_comment after insert on public.postcard_comments
  for each row execute function public.inbox_postcard_comment();
