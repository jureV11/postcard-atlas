-- Postcard Atlas — arrived, but nobody knows exactly when (#4).
--
-- A received card used to need a received date. Now the recipient can tick
-- "I don't know when it arrived": the card counts as delivered everywhere, and
-- is simply left out of anything about timing (average days, fastest/slowest,
-- the replay, monthly chart). No date is ever made up.
--
-- ADDITIVE: one new column; the "received ⇔ has a date" rule is replaced by one
-- that also allows "received, date unknown" (every existing card stays valid).
-- Functions replaced. No data is changed.
-- Run in Supabase → SQL Editor after 0015. Safe to run more than once.

alter table public.postcards
  add column if not exists arrival_date_unknown boolean not null default false;

-- Find and drop the old unnamed rule "(status = 'received') = (received_on is not null)".
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.postcards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%received_on IS NOT NULL%'
      and pg_get_constraintdef(oid) ilike '%status%'
      and conname <> 'postcards_received_date_check'
  loop
    execute format('alter table public.postcards drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.postcards drop constraint if exists postcards_received_date_check;
alter table public.postcards add constraint postcards_received_date_check check (
  (status = 'received' and (received_on is not null or arrival_date_unknown))
  or (status <> 'received' and received_on is null and not arrival_date_unknown)
);

-- ─── Receiving: no date means "unknown" ──────────────────────────────────────

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
    arrival_date_unknown = p_received_on is null,
    lost_on = null,
    message = coalesce(message, nullif(trim(p_message), ''))
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
    arrival_date_unknown = p_received_on is null,
    message     = nullif(trim(p_message), '')
  where id = p_id;
end;
$$;

-- "Oops, wrong card": back in transit, so no date and no "unknown" either.
create or replace function public.unmark_received(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update postcards set
    status = 'in_transit',
    received_on = null,
    arrival_date_unknown = false,
    front_path = null,
    back_path = null
  where id = p_id and recipient_id = my_member_id() and status = 'received';
  if not found then
    raise exception 'Only the person who received this postcard can undo that';
  end if;
end;
$$;
