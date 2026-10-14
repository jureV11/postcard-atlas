-- Postcard Atlas — match an arrived postcard to the right mystery card.
-- With several cards on their way to you, you can't pick one blind. Instead you
-- say who it's from (the signature) and, if needed, the country (the stamp), and
-- the database finds the matching card. A wrong guess reveals nothing.
-- Run in Supabase → SQL Editor after 0005. Safe to run more than once.

create or replace function public.find_incoming_postcard(p_sender_id uuid, p_country_code text default null)
returns table (id uuid, sent_on date, has_message boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := my_member_id();
  matches int;
begin
  if me is null then
    raise exception 'You are not in a group';
  end if;

  select count(*) into matches
  from postcards p
  where p.recipient_id = me and p.status = 'in_transit' and p.sender_id = p_sender_id
    and (p_country_code is null or p.from_country_code = upper(p_country_code));

  if matches = 0 then
    raise exception 'NO_MATCH';
  end if;
  if matches > 1 and p_country_code is null then
    raise exception 'NEED_COUNTRY';
  end if;

  -- Same sender and country twice? Take the one that's been travelling longest.
  return query
  select p.id, p.sent_on, p.message is not null
  from postcards p
  where p.recipient_id = me and p.status = 'in_transit' and p.sender_id = p_sender_id
    and (p_country_code is null or p.from_country_code = upper(p_country_code))
  order by p.sent_on, p.created_at
  limit 1;
end;
$$;

revoke execute on function public.find_incoming_postcard(uuid, text) from public, anon;
grant execute on function public.find_incoming_postcard(uuid, text) to authenticated;
