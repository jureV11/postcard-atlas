-- Postcard Atlas — only the recipient photographs the postcard.
-- The sender logs where/when; the person holding the card adds the front & back.
-- Run in Supabase → SQL Editor after 0004. Safe to run more than once.

-- Photos: recipient only (while marking it received, or later to replace them).
create or replace function public.set_postcard_photos(p_id uuid, p_front_path text, p_back_path text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
  prefix text;
begin
  select * into card from postcards where id = p_id;
  if not found or card.recipient_id is distinct from my_member_id() then
    raise exception 'Only the person who received this postcard can add its photos';
  end if;

  prefix := card.group_id::text || '/' || card.id::text || '/';
  if (p_front_path is not null and left(p_front_path, length(prefix)) <> prefix)
     or (p_back_path is not null and left(p_back_path, length(prefix)) <> prefix) then
    raise exception 'Invalid photo path';
  end if;

  update postcards set
    front_path = coalesce(p_front_path, front_path),
    back_path  = coalesce(p_back_path,  back_path)
  where id = p_id;
end;
$$;

-- Storage: only the recipient may upload; the sender may still clean up files
-- when deleting a card that hasn't arrived yet.
create or replace function public.postcard_media_access(p_card text, p_mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from postcards p
    where p.id::text = p_card
      and p.group_id = my_group_id()
      and case p_mode
            when 'read'   then p.status = 'received' or p.sender_id = my_member_id()
                               or p.recipient_id = my_member_id()
            when 'write'  then p.recipient_id = my_member_id()
            when 'delete' then p.sender_id = my_member_id()
            else false
          end
  )
$$;

-- The sender can only take a card back while it's still in transit.
create or replace function public.delete_postcard(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  delete from postcards
  where id = p_id and sender_id = my_member_id() and status = 'in_transit';
  if not found then
    raise exception 'Only the sender can delete a postcard, and only before it has arrived';
  end if;
end;
$$;
