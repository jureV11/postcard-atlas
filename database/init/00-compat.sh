#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 -v dbpass="$POSTGRES_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role authenticator login noinherit;
create role identity_reader login;
grant anon, authenticated to authenticator;
select format('alter role authenticator password %L', :'dbpass') \gexec
select format('alter role identity_reader password %L', :'dbpass') \gexec
create schema auth;
create table auth.users (id uuid primary key, email text not null unique, enabled boolean not null default false);
create unique index users_email_lower_idx on auth.users (lower(email));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to authenticated, identity_reader;
grant execute on function auth.uid() to authenticated;
grant select (id, email, enabled) on auth.users to identity_reader;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
create function storage.foldername(path text) returns text[] language sql immutable as $$ select string_to_array(path, '/') $$;
grant usage on schema public to anon, authenticated;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
alter table storage.objects enable row level security;
SQL
for migration in /app-migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
done
