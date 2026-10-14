-- Postcard Atlas — no spoilers.
--
-- 1. Nobody sees a card in transit except its sender (not even that it exists).
-- 2. Cards from the same trip — same sender, posted within 10 days of each other —
--    go public together. Until every one of them has arrived, each card is only
--    visible to its sender and to the person who received it. Once the last one
--    lands, everyone sees them all: where from, photos, routes.
--
-- Run in Supabase → SQL Editor after 0008. Safe to run more than once.

create or replace function public.postcard_is_public(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p.status = 'received' and not exists (
    select 1 from postcards o
    where o.sender_id = p.sender_id
      and o.id <> p.id
      and o.status = 'in_transit'
      and abs(o.sent_on - p.sent_on) <= 10
  )
  from postcards p
  where p.id = p_id
$$;

drop view if exists public.postcard_feed;

-- Only rows the viewer may see are returned at all, and those are shown in full.
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
  v.is_public
from public.postcards p
cross join lateral (select public.postcard_is_public(p.id) as is_public) v
where p.group_id = public.my_group_id()
  and (
    p.sender_id = public.my_member_id()
    or (p.recipient_id = public.my_member_id() and p.status = 'received')
    or v.is_public
  );

revoke all on public.postcard_feed from anon, authenticated;
grant select on public.postcard_feed to authenticated;

-- Photos follow the same rule.
create or replace function public.postcard_media_access(p_card text, p_mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from postcards p
    where p.id::text = p_card
      and p.group_id = my_group_id()
      and case p_mode
            when 'read'   then my_member_id() in (p.sender_id, p.recipient_id) or postcard_is_public(p.id)
            when 'write'  then p.recipient_id = my_member_id()
            when 'delete' then my_member_id() in (p.sender_id, p.recipient_id)
            else false
          end
  )
$$;

revoke execute on function public.postcard_is_public(uuid) from public, anon;
grant execute on function public.postcard_is_public(uuid) to authenticated;
