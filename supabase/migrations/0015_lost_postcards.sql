-- Postcard Atlas — postcards lost in the post.
--
-- The sender can mark a card that never arrived as lost (or log an old one as
-- lost straight away). A lost card is no longer a surprise, so it goes public
-- like an arrived one — under the same trip rule: not while other cards from
-- that trip are still travelling. If it turns up after all, the recipient's
-- usual "A postcard arrived!" flow still finds it, or the sender can undo.
--
-- ADDITIVE: the status rule is widened to also allow 'lost' (every existing
-- card stays valid), plus one new column and functions. No data is changed.
-- Run in Supabase → SQL Editor after 0014. Safe to run more than once.

-- ─── Status may now also be 'lost' ───────────────────────────────────────────

alter table public.postcards drop constraint if exists postcards_status_check;
alter table public.postcards
  add constraint postcards_status_check check (status in ('in_transit', 'received', 'lost'));

alter table public.postcards add column if not exists lost_on date;

-- ─── Lost cards go public too (same trip rule) ───────────────────────────────

create or replace function public.postcard_is_public(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p.status in ('received', 'lost') and not exists (
    select 1 from postcards o
    where o.sender_id = p.sender_id
      and o.id <> p.id
      and o.status = 'in_transit'
      and abs(o.sent_on - p.sent_on) <= 10
  )
  from postcards p
  where p.id = p_id
$$;

-- The feed view reads postcard_is_public(), so it picks this up as it is.
-- It also needs lost_on: rebuilt with the same rules as 0012 plus that column.
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
  a.lng          as to_lng,
  p.lost_on
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

-- ─── Mark lost / found again (sender only) ───────────────────────────────────

create or replace function public.mark_lost(p_id uuid, p_lost_on date default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
begin
  select * into card from postcards where id = p_id;
  if not found or card.sender_id is distinct from my_member_id() then
    raise exception 'Only the sender can mark this postcard as lost';
  end if;
  if card.status = 'received' then
    raise exception 'This postcard already arrived';
  end if;
  update postcards
  set status = 'lost', lost_on = coalesce(p_lost_on, lost_on, current_date)
  where id = p_id;
end;
$$;

create or replace function public.unmark_lost(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update postcards set status = 'in_transit', lost_on = null
  where id = p_id and sender_id = my_member_id() and status = 'lost';
  if not found then
    raise exception 'Only the sender can undo this';
  end if;
end;
$$;

-- ─── It turned up after all: arrival matching also finds lost cards ─────────

create or replace function public.find_incoming_postcard(p_sender_id uuid, p_country_code text default null)
returns table (id uuid, sent_on date, has_message boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := my_member_id();
begin
  if me is null then
    raise exception 'You are not in a group';
  end if;
  if p_sender_id is null or p_country_code is null or trim(p_country_code) = '' then
    raise exception 'NEED_COUNTRY';
  end if;

  return query
  select p.id, p.sent_on, p.message is not null
  from postcards p
  where p.recipient_id = me
    and p.status in ('in_transit', 'lost')
    and p.sender_id = p_sender_id
    and p.from_country_code = upper(trim(p_country_code))
  -- Cards still on their way first, then the oldest.
  order by (p.status = 'lost'), p.sent_on, p.created_at
  limit 1;

  if not found then
    raise exception 'NO_MATCH';
  end if;
end;
$$;

-- Receiving a card clears any "lost" date.
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
    lost_on = null,
    message = coalesce(message, nullif(trim(p_message), ''))
  where id = p_id;
end;
$$;

revoke execute on function public.mark_lost(uuid, date) from public, anon;
revoke execute on function public.unmark_lost(uuid) from public, anon;
grant execute on function public.mark_lost(uuid, date) to authenticated;
grant execute on function public.unmark_lost(uuid) to authenticated;
