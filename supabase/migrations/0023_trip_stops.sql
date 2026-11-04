-- Postcard Atlas — trips through several cities.
--
-- #45: a meetup can be a trip through several places (Beijing → Xi'an → Shanghai).
-- The meetup's own city / country / lat / lng stay the first place, so every
-- meetup logged so far is unchanged; `stops` holds the places after it, in the
-- order you went: [{ "name", "country", "countryCode", "lat", "lng" }, …].
--
-- Meetups are already readable and editable by the whole group (policies from
-- 0020); the new column is covered by them, so no policy changes are needed.
--
-- ADDITIVE: one new column, empty for every existing meetup. No data is changed.
-- Run in Supabase → SQL Editor after 0022. Safe to run more than once.

alter table public.meetups add column if not exists stops jsonb not null default '[]'::jsonb;

alter table public.meetups drop constraint if exists meetups_stops_list;
alter table public.meetups add constraint meetups_stops_list
  check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 30);
