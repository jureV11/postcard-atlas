-- Postcard Atlas — leaving a group.
-- Allowed only if you have no postcards there (sent or received): removing a
-- member would otherwise delete other people's cards along with yours.
-- The last person to leave takes the empty group with them.
-- Run in Supabase → SQL Editor after 0009. Safe to run more than once.

create or replace function public.leave_group()
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me public.members;
begin
  select * into me from members where user_id = auth.uid();
  if not found then
    raise exception 'You are not in a group';
  end if;

  if exists (select 1 from postcards where sender_id = me.id or recipient_id = me.id) then
    raise exception 'You have postcards in this group, so you can''t leave — they''d disappear for everyone else too';
  end if;

  delete from members where id = me.id;

  if not exists (select 1 from members where group_id = me.group_id) then
    delete from groups where id = me.group_id;
  end if;
end;
$$;

revoke execute on function public.leave_group() from public, anon;
grant execute on function public.leave_group() to authenticated;
