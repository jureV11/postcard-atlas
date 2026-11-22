-- Postcard Atlas — choosing a trip's flags.
--
-- #65: a trip showed the flag of its first place, even when that was a two-hour
-- stop on the way. Now whoever edits it can pick which countries' flags it shows
-- (one or several). `flag_codes` holds those country codes, like {PR,AF}.
-- Empty means nobody picked: it shows the first place's flag, as before, so every
-- meetup logged so far is unchanged.
--
-- Meetups are already readable and editable by the whole group (policies from
-- 0020); the new column is covered by them, so no policy changes are needed.
--
-- ADDITIVE: one new column, empty for every existing meetup. No data is changed.
-- Run on the live database after 0025. Safe to run more than once.

alter table public.meetups add column if not exists flag_codes text[] not null default '{}';

alter table public.meetups drop constraint if exists meetups_flag_codes_list;
alter table public.meetups add constraint meetups_flag_codes_list
  check (cardinality(flag_codes) <= 31);

-- The API keeps its own copy of what columns exist: tell it to look again, so the
-- new column works straight away without restarting anything.
notify pgrst, 'reload schema';
