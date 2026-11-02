-- Postcard Atlas — more for meetup photos.
--
-- #25: a short caption on each photo.
-- #27: photos can be put in any order (position).
-- #30: choose which part of the main photo shows on the timeline (focus_x / focus_y,
--      in percent across and down; empty means the middle).
-- #31: up to 50 photos per meetup instead of 10.
--
-- Anyone in the group can already edit meetup photos (the "group edits" policy
-- from 0020), so no policy changes are needed.
--
-- ADDITIVE: four new columns and a new photo limit. No data is changed.
-- Run in Supabase → SQL Editor after 0020. Safe to run more than once.

alter table public.meetup_photos add column if not exists caption text;
alter table public.meetup_photos add column if not exists position integer;
alter table public.meetup_photos add column if not exists focus_x real;
alter table public.meetup_photos add column if not exists focus_y real;

alter table public.meetup_photos drop constraint if exists meetup_photos_caption_length;
alter table public.meetup_photos add constraint meetup_photos_caption_length
  check (caption is null or length(caption) <= 300);

alter table public.meetup_photos drop constraint if exists meetup_photos_focus_range;
alter table public.meetup_photos add constraint meetup_photos_focus_range
  check ((focus_x is null or focus_x between 0 and 100) and (focus_y is null or focus_y between 0 and 100));

-- At most 50 photos per meetup.
create or replace function public.meetup_photo_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from meetup_photos where meetup_id = new.meetup_id) >= 50 then
    raise exception 'A meetup can have up to 50 photos';
  end if;
  return new;
end;
$$;
