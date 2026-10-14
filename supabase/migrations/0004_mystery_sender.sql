-- Postcard Atlas — in-transit cards hide WHO sent them too, not just where from.
-- Only the sender sees their own card until it's received.
-- Run in Supabase → SQL Editor (safe to run even if 0003 was skipped).

drop view if exists public.postcard_feed;

create view public.postcard_feed as
select
  p.id, p.group_id,
  case when v.revealed then p.sender_id         end as sender_id,
  p.recipient_id,
  case when v.revealed then p.from_city         end as from_city,
  case when v.revealed then p.from_country      end as from_country,
  case when v.revealed then p.from_country_code end as from_country_code,
  case when v.revealed then p.from_lat          end as from_lat,
  case when v.revealed then p.from_lng          end as from_lng,
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
