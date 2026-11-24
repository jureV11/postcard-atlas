-- Postcard Atlas — videos on meetups.
--
-- #55: a meetup's gallery can hold videos as well as photos. A video is a row in
-- meetup_photos like a photo (so it has a caption, an order and counts in the
-- 50-item limit), with:
--   kind          'photo' (every row so far) or 'video'
--   poster_path   the still image shown before it plays (videos only)
--   video_status  'processing' while the server converts it, then 'ready' or 'failed'
-- A video can't be the main photo: the timeline shows the main photo as a picture.
--
-- Who can see, add, change and remove them is unchanged: the meetup_photos
-- policies from 0020 already cover every row, whatever its kind.
--
-- ADDITIVE: three new columns, every existing row becomes kind 'photo'. No data is changed.
-- Run on the live database after 0027. Safe to run more than once.

alter table public.meetup_photos add column if not exists kind text not null default 'photo';
alter table public.meetup_photos add column if not exists poster_path text;
alter table public.meetup_photos add column if not exists video_status text;

alter table public.meetup_photos drop constraint if exists meetup_photos_kind;
alter table public.meetup_photos add constraint meetup_photos_kind
  check (kind in ('photo', 'video'));

alter table public.meetup_photos drop constraint if exists meetup_photos_video_status;
alter table public.meetup_photos add constraint meetup_photos_video_status
  check (video_status is null or video_status in ('processing', 'ready', 'failed'));

alter table public.meetup_photos drop constraint if exists meetup_photos_video_not_main;
alter table public.meetup_photos add constraint meetup_photos_video_not_main
  check (kind = 'photo' or not is_main);

-- The API keeps its own copy of what columns exist: tell it to look again.
notify pgrst, 'reload schema';
