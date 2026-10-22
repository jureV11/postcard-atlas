-- Postcard Atlas — the sender can add photos to a lost postcard.
--
-- Photos are normally the recipient's job (they hold the card). A lost card
-- never reaches them, so its sender may add the front/back instead — e.g. a
-- photo they took before posting it. Only while the card is marked lost.
--
-- ADDITIVE: two functions replaced, each with one extra allowed case.
-- No tables or data change.
-- Run in Supabase → SQL Editor after 0017. Safe to run more than once.

create or replace function public.set_postcard_photos(p_id uuid, p_front_path text, p_back_path text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  card public.postcards;
  prefix text;
begin
  select * into card from postcards where id = p_id;
  if not found
     or not (card.recipient_id = my_member_id()
             or (card.status = 'lost' and card.sender_id = my_member_id())) then
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

-- Storage: same rules as 0009, plus "write" for the sender of a lost card.
create or replace function public.postcard_media_access(p_card text, p_mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from postcards p
    where p.id::text = p_card
      and p.group_id = my_group_id()
      and case p_mode
            when 'read'   then my_member_id() in (p.sender_id, p.recipient_id) or postcard_is_public(p.id)
            when 'write'  then p.recipient_id = my_member_id()
                               or (p.status = 'lost' and p.sender_id = my_member_id())
            when 'delete' then my_member_id() in (p.sender_id, p.recipient_id)
            else false
          end
  )
$$;
