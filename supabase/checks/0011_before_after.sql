-- Run this in the SQL Editor BEFORE and AFTER migration 0011 and compare.
-- The first five numbers must be identical before and after: nothing is lost.
-- (Read-only — it changes nothing.)

select
  (select count(*) from public.groups)                                   as groups,
  (select count(*) from public.members)                                  as members,
  (select count(*) from public.postcards)                                as postcards,
  (select count(*) from public.postcards where status = 'received')      as received,
  (select count(*) from storage.objects where bucket_id = 'postcards')   as postcard_photos;

-- After 0011 only: every group should now have an owner (owner column filled in).
-- select g.name, m.display_name as owner
-- from public.groups g left join public.members m on m.id = g.owner_member_id;
