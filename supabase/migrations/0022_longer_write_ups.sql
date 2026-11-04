-- Postcard Atlas — longer meetup write-ups.
--
-- #47: a write-up could only be 4,000 characters (about 700 words), too short for
-- long trips. Now 200,000 characters, about 33,000 words, per person per meetup:
-- text is tiny, so this only guards against something like a huge accidental paste.
--
-- ADDITIVE: only the length check on meetup_notes.body is replaced by a looser one.
-- No data is changed: every write-up that fit before still fits.
-- Run in Supabase → SQL Editor after 0021. Safe to run more than once.

-- The old check was written inline in 0020, so Postgres picked its name: remove
-- every check on meetup_notes that limits the body, whatever it's called.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.meetup_notes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%body%'
  loop
    execute format('alter table public.meetup_notes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.meetup_notes add constraint meetup_notes_body_check
  check (length(btrim(body)) between 1 and 200000);
