-- Supabase supplied these SELECT grants by default. Local PostgreSQL needs
-- them explicitly. Existing RLS policies still restrict reads to one's group.
grant select on public.groups, public.members to authenticated;
