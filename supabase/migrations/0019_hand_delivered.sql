-- Postcard Atlas — postcards handed over in person instead of posted (#10).
--
-- The sender ticks "Hand delivered" when logging or editing a card. The card
-- works like any other (it's still a surprise until the recipient logs it as
-- arrived), but it never spent time in the post, so it's left out of the
-- delivery-time stats.
--
-- ADDITIVE: one new column, one new function, and the feed view rebuilt with
-- the same rules as 0015 plus that column. No data is changed.
-- Run in Supabase → SQL Editor after 0018. Safe to run more than once.

alter table public.postcards
  add column if not exists hand_delivered boolean not null default false;

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
  p.lost_on,
  p.hand_delivered
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

-- Sender only: mark a card as handed over in person (or take that back).
create or replace function public.set_hand_delivered(p_id uuid, p_value boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update postcards set hand_delivered = coalesce(p_value, false)
  where id = p_id and sender_id = my_member_id();
  if not found then
    raise exception 'Only the sender can change this';
  end if;
end;
$$;

revoke execute on function public.set_hand_delivered(uuid, boolean) from public, anon;
grant execute on function public.set_hand_delivered(uuid, boolean) to authenticated;
