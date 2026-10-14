-- Postcard Atlas — step 2: postcards, photos, in-transit / received flow
-- Run in Supabase → SQL Editor after 0001.

create or replace function public.my_member_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.members where user_id = auth.uid()
$$;

-- ─── Table ───────────────────────────────────────────────────────────────────

create table public.postcards (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references public.groups (id) on delete cascade,
  sender_id         uuid not null references public.members (id) on delete cascade,
  recipient_id      uuid not null references public.members (id) on delete cascade,
  from_city         text not null,
  from_country      text not null,
  from_country_code char(2) not null,
  from_lat          double precision not null check (from_lat between -90 and 90),
  from_lng          double precision not null check (from_lng between -180 and 180),
  sent_on           date not null,
  received_on       date,
  status            text not null default 'in_transit' check (status in ('in_transit', 'received')),
  front_path        text,
  back_path         text,
  message           text check (char_length(message) <= 4000),
  note              text check (char_length(note) <= 500),
  created_at        timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check ((status = 'received') = (received_on is not null)),
  check (received_on is null or received_on >= sent_on)
);

create index postcards_group_id_idx on public.postcards (group_id);

-- No direct access: reads go through postcard_feed, writes through the RPCs below.
alter table public.postcards enable row level security;
revoke all on public.postcards from anon, authenticated;

-- ─── Read model ──────────────────────────────────────────────────────────────
-- Everyone in the group sees every card's route and dates (for the map), but
-- photos, message and note stay hidden until it's received — except to the sender.

create view public.postcard_feed as
select
  p.id, p.group_id, p.sender_id, p.recipient_id,
  p.from_city, p.from_country, p.from_country_code, p.from_lat, p.from_lng,
  p.sent_on, p.received_on, p.status, p.created_at,
  v.revealed,
  case when v.revealed then p.front_path end as front_path,
  case when v.revealed then p.back_path  end as back_path,
  case when v.revealed then p.message    end as message,
  case when v.revealed then p.note       end as note,
  p.front_path is not null as has_front,
  p.back_path  is not null as has_back,
  p.message    is not null as has_message
from public.postcards p
cross join lateral (
  select (p.status = 'received' or p.sender_id = public.my_member_id()) as revealed
) v
where p.group_id = public.my_group_id();

revoke all on public.postcard_feed from anon, authenticated;
grant select on public.postcard_feed to authenticated;

-- ─── Writes ──────────────────────────────────────────────────────────────────

create or replace function public.log_postcard(
  p_id                uuid,
  p_recipient_id      uuid,
  p_from_city         text,
  p_from_country      text,
  p_from_country_code text,
  p_from_lat          double precision,
  p_from_lng          double precision,
  p_sent_on           date,
  p_message           text,
  p_note              text
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  me public.members;
  v_id uuid;
begin
  select * into me from members where user_id = auth.uid();
  if not found then
    raise exception 'You are not in a group';
  end if;
  if p_recipient_id = me.id then
    raise exception 'You can''t send a postcard to yourself';
  end if;
  if not exists (select 1 from members where id = p_recipient_id and group_id = me.group_id) then
    raise exception 'That person isn''t in your group';
  end if;

  insert into postcards (id, group_id, sender_id, recipient_id, from_city, from_country,
                         from_country_code, from_lat, from_lng, sent_on, message, note)
  values (coalesce(p_id, gen_random_uuid()), me.group_id, me.id, p_recipient_id, p_from_city,
          p_from_country, upper(p_from_country_code), p_from_lat, p_from_lng, p_sent_on,
          nullif(trim(p_message), ''), nullif(trim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- Sender can set photos any time. Recipient can fill in missing sides while in
-- transit (they can't see what's there), and replace either side once received.
create or replace function public.set_postcard_photos(p_id uuid, p_front_path text, p_back_path text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
  me uuid := my_member_id();
  prefix text;
  full_access boolean;
begin
  select * into card from postcards where id = p_id;
  if not found or me is null or me not in (card.sender_id, card.recipient_id) then
    raise exception 'Postcard not found';
  end if;

  prefix := card.group_id::text || '/' || card.id::text || '/';
  if (p_front_path is not null and left(p_front_path, length(prefix)) <> prefix)
     or (p_back_path is not null and left(p_back_path, length(prefix)) <> prefix) then
    raise exception 'Invalid photo path';
  end if;

  full_access := me = card.sender_id or card.status = 'received';

  update postcards set
    front_path = case when full_access or front_path is null then coalesce(p_front_path, front_path) else front_path end,
    back_path  = case when full_access or back_path  is null then coalesce(p_back_path,  back_path)  else back_path  end
  where id = p_id;
end;
$$;

create or replace function public.mark_received(p_id uuid, p_received_on date, p_message text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
begin
  select * into card from postcards where id = p_id;
  if not found or card.recipient_id is distinct from my_member_id() then
    raise exception 'Only the recipient can mark this postcard as received';
  end if;
  if card.status = 'received' then
    return;
  end if;
  if p_received_on < card.sent_on then
    raise exception 'The received date can''t be before the date it was sent (%)', card.sent_on;
  end if;

  update postcards set
    status = 'received',
    received_on = p_received_on,
    message = coalesce(message, nullif(trim(p_message), ''))
  where id = p_id;
end;
$$;

create or replace function public.delete_postcard(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  delete from postcards where id = p_id and sender_id = my_member_id();
  if not found then
    raise exception 'Only the sender can delete this postcard';
  end if;
end;
$$;

revoke execute on function public.log_postcard(uuid, uuid, text, text, text, double precision, double precision, date, text, text) from public, anon;
revoke execute on function public.set_postcard_photos(uuid, text, text) from public, anon;
revoke execute on function public.mark_received(uuid, date, text) from public, anon;
revoke execute on function public.delete_postcard(uuid) from public, anon;
grant execute on function public.log_postcard(uuid, uuid, text, text, text, double precision, double precision, date, text, text) to authenticated;
grant execute on function public.set_postcard_photos(uuid, text, text) to authenticated;
grant execute on function public.mark_received(uuid, date, text) to authenticated;
grant execute on function public.delete_postcard(uuid) to authenticated;

-- ─── Storage: private postcards bucket ───────────────────────────────────────
-- Paths are "<group_id>/<postcard_id>/<side>-<timestamp>.jpg".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postcards', 'postcards', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.postcard_media_access(p_card text, p_mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from postcards p
    where p.id::text = p_card
      and p.group_id = my_group_id()
      and case p_mode
            when 'read'   then p.status = 'received' or p.sender_id = my_member_id()
            when 'write'  then my_member_id() in (p.sender_id, p.recipient_id)
            when 'delete' then p.sender_id = my_member_id()
            else false
          end
  )
$$;

create policy "postcards: read revealed"
  on storage.objects for select to authenticated
  using (bucket_id = 'postcards'
         and (storage.foldername(name))[1] = public.my_group_id()::text
         and public.postcard_media_access((storage.foldername(name))[2], 'read'));

create policy "postcards: upload own cards"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'postcards'
              and (storage.foldername(name))[1] = public.my_group_id()::text
              and public.postcard_media_access((storage.foldername(name))[2], 'write'));

create policy "postcards: sender deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'postcards'
         and (storage.foldername(name))[1] = public.my_group_id()::text
         and public.postcard_media_access((storage.foldername(name))[2], 'delete'));
