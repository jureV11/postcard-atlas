-- Postcard Atlas — fixing mistakes.
--   Sender:    edit where/when/message/note any time; change the recipient only
--              while it's in transit.
--   Recipient: edit the received date / message, or undo "received" if they
--              matched the wrong card (it goes back to being a mystery).
-- Run in Supabase → SQL Editor after 0006. Safe to run more than once.

create or replace function public.update_postcard(
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
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
  me uuid := my_member_id();
begin
  select * into card from postcards where id = p_id;
  if not found or card.sender_id is distinct from me then
    raise exception 'Only the sender can edit this postcard';
  end if;
  if p_recipient_id <> card.recipient_id then
    if card.status = 'received' then
      raise exception 'This postcard has already arrived, so who it went to can''t change';
    end if;
    if p_recipient_id = me then
      raise exception 'You can''t send a postcard to yourself';
    end if;
    if not exists (select 1 from members where id = p_recipient_id and group_id = card.group_id) then
      raise exception 'That person isn''t in your group';
    end if;
  end if;
  if card.received_on is not null and p_sent_on > card.received_on then
    raise exception 'The sent date can''t be after it was received (%)', card.received_on;
  end if;

  update postcards set
    recipient_id      = p_recipient_id,
    from_city         = p_from_city,
    from_country      = p_from_country,
    from_country_code = upper(p_from_country_code),
    from_lat          = p_from_lat,
    from_lng          = p_from_lng,
    sent_on           = p_sent_on,
    message           = nullif(trim(p_message), ''),
    note              = nullif(trim(p_note), '')
  where id = p_id;
end;
$$;

create or replace function public.update_received(p_id uuid, p_received_on date, p_message text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
begin
  select * into card from postcards where id = p_id;
  if not found or card.recipient_id is distinct from my_member_id() or card.status <> 'received' then
    raise exception 'Only the person who received this postcard can edit that';
  end if;
  if p_received_on < card.sent_on then
    raise exception 'The received date can''t be before the date it was sent (%)', card.sent_on;
  end if;

  update postcards set
    received_on = p_received_on,
    message     = nullif(trim(p_message), '')
  where id = p_id;
end;
$$;

-- "Oops, wrong card": back to a mystery. The photos belonged to the other card,
-- so they're detached (the app deletes the files).
create or replace function public.unmark_received(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update postcards set
    status = 'in_transit',
    received_on = null,
    front_path = null,
    back_path = null
  where id = p_id and recipient_id = my_member_id() and status = 'received';
  if not found then
    raise exception 'Only the person who received this postcard can undo that';
  end if;
end;
$$;

-- Recipients may now delete photo files too (needed when undoing a wrong match).
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
                               or p.recipient_id = my_member_id()
            when 'write'  then p.recipient_id = my_member_id()
            when 'delete' then my_member_id() in (p.sender_id, p.recipient_id)
            else false
          end
  )
$$;

revoke execute on function public.update_postcard(uuid, uuid, text, text, text, double precision, double precision, date, text, text) from public, anon;
revoke execute on function public.update_received(uuid, date, text) from public, anon;
revoke execute on function public.unmark_received(uuid) from public, anon;
grant execute on function public.update_postcard(uuid, uuid, text, text, text, double precision, double precision, date, text, text) to authenticated;
grant execute on function public.update_received(uuid, date, text) to authenticated;
grant execute on function public.unmark_received(uuid) to authenticated;
