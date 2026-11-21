-- Postcard Atlas — longer notes on postcards.
--
-- #61: a postcard's note could only be 500 characters, too short when there's a lot
-- to say about where it was found or what it's about. Now 2,000 (four times as much).
--
-- ADDITIVE: only the length check on postcards.note is replaced by a looser one.
-- No data is changed: every note that fit before still fits.
-- Run on the live database after 0024. Safe to run more than once.

-- The old check was written inline in 0002, so Postgres picked its name: remove
-- every check on postcards that limits the note, whatever it's called.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.postcards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%note%'
  loop
    execute format('alter table public.postcards drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.postcards add constraint postcards_note_check
  check (char_length(note) <= 2000);
