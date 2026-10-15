-- Read-only check: every member row, which group it's in, and whether it's active.
-- Run in Supabase → SQL Editor. Changes nothing.
select g.name                       as group_name,
       g.invite_code,
       m.display_name,
       u.email                      as account_email,
       (m.user_id is not null)      as has_account,
       m.left_at,
       fu.email                     as former_account_email,
       m.created_at
from public.members m
join public.groups g on g.id = m.group_id
left join auth.users u  on u.id  = m.user_id
left join auth.users fu on fu.id = m.former_user_id
order by g.name, m.left_at nulls first, m.created_at;
