-- Postcard Atlas — phone notifications (web push).
--
-- Each phone/browser that turns notifications on saves a "subscription" (an
-- address only that browser's push service accepts). Those addresses must
-- never reach other people's browsers, so:
--   - the table can't be read by anyone directly (no grants at all);
--   - you can only add or remove your own, through the functions below;
--   - only the site's server can look them up, by proving it knows the server
--     secret stored in push_config (it lives in the server's settings, never
--     in the browser). The server decides who to notify: never anything about
--     a card that's still on its way.
--
-- ADDITIVE ONLY: two new tables and functions. No existing data is touched.
-- Run in Supabase → SQL Editor after 0016. Safe to run more than once.
-- Then set the server secret once (see HOSTING.md → Notifications).

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member_idx on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- One row, readable by nobody but the functions below.
create table if not exists public.push_config (
  id     int primary key default 1 check (id = 1),
  secret text check (secret is null or length(secret) >= 32)
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- ─── Your own subscriptions ──────────────────────────────────────────────────

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me uuid := my_member_id();
begin
  if me is null then raise exception 'You are not in a group'; end if;
  insert into push_subscriptions (member_id, endpoint, p256dh, auth)
  values (me, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql volatile security definer set search_path = public
as $$
  delete from push_subscriptions where endpoint = p_endpoint and member_id = my_member_id();
$$;

-- Is notifications on for this browser? (Only answers about your own.)
create or replace function public.has_push_subscription(p_endpoint text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from push_subscriptions where endpoint = p_endpoint and member_id = my_member_id());
$$;

-- ─── For the server only (needs the secret) ──────────────────────────────────

create or replace function public.push_targets(p_secret text, p_member_ids uuid[])
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_secret text;
begin
  select secret into v_secret from push_config where id = 1;
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'Not allowed';
  end if;
  return query
  select s.endpoint, s.p256dh, s.auth from push_subscriptions s where s.member_id = any (p_member_ids);
end;
$$;

-- A phone that unsubscribed or reinstalled: its push service says "gone".
create or replace function public.forget_push_endpoint(p_secret text, p_endpoint text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_secret text;
begin
  select secret into v_secret from push_config where id = 1;
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'Not allowed';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
revoke execute on function public.has_push_subscription(text) from public, anon;
revoke execute on function public.push_targets(text, uuid[]) from public, anon;
revoke execute on function public.forget_push_endpoint(text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.has_push_subscription(text) to authenticated;
grant execute on function public.push_targets(text, uuid[]) to authenticated;
grant execute on function public.forget_push_endpoint(text, text) to authenticated;
