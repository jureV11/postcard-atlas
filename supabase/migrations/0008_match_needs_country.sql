-- Postcard Atlas — matching an arrived postcard always needs BOTH the sender
-- (signature) and the country (stamp). Picking only a name could reveal the
-- wrong card if you guessed wrong; now a wrong name or country just says
-- "no match" and nothing is revealed.
-- Run in Supabase → SQL Editor after 0007. Safe to run more than once.

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
    and p.status = 'in_transit'
    and p.sender_id = p_sender_id
    and p.from_country_code = upper(trim(p_country_code))
  -- Same sender and country twice? Take the one that's been travelling longest.
  order by p.sent_on, p.created_at
  limit 1;

  if not found then
    raise exception 'NO_MATCH';
  end if;
end;
$$;

revoke execute on function public.find_incoming_postcard(uuid, text) from public, anon;
grant execute on function public.find_incoming_postcard(uuid, text) to authenticated;
