-- Migration 0012 checks. Read-only — changes nothing.
--
-- 1) Run BEFORE and AFTER 0012. The numbers must be identical: nothing lost,
--    and total distance unchanged (to the metre).

select
  (select count(*) from public.members)                               as members,
  (select count(*) from public.postcards)                             as postcards,
  (select count(*) from public.postcards where status = 'received')   as received,
  round((select sum(
     2 * 6371 * asin(sqrt(
       power(sin(radians(m.home_lat - p.from_lat) / 2), 2) +
       cos(radians(p.from_lat)) * cos(radians(m.home_lat)) *
       power(sin(radians(m.home_lng - p.from_lng) / 2), 2)))
   ) from public.postcards p join public.members m on m.id = p.recipient_id)::numeric, 3) as total_km_to_home;

-- 2) AFTER 0012 only (remove the leading "-- " from the query below and run it):
--    total km measured to the LINKED address must equal total_km_to_home above,
--    and every count in the second row must be 0.
--
-- select
--   round((select sum(
--      2 * 6371 * asin(sqrt(
--        power(sin(radians(a.lat - p.from_lat) / 2), 2) +
--        cos(radians(p.from_lat)) * cos(radians(a.lat)) *
--        power(sin(radians(a.lng - p.from_lng) / 2), 2)))
--    ) from public.postcards p join public.member_addresses a on a.id = p.recipient_address_id)::numeric, 3) as total_km_to_address,
--   (select count(*) from public.postcards where recipient_address_id is null)            as cards_without_address,
--   (select count(*) from public.members m where not exists (
--      select 1 from public.member_addresses a where a.member_id = m.id and a.is_current)) as members_without_current_address,
--   (select count(*) from public.postcards p join public.member_addresses a on a.id = p.recipient_address_id
--      where a.member_id <> p.recipient_id)                                                  as cards_linked_to_wrong_person;
