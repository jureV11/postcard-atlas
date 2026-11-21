# Hosting Postcard Atlas

Postcard Atlas runs with Docker Compose: Next.js, PostgreSQL, and an internal PostgREST API. Photos live in `UPLOAD_LOCATION`; PostgreSQL files live in `DB_DATA_LOCATION`. Back up **both** directories. Only the web port is published, on loopback, for your Cloudflare-protected reverse proxy or tunnel.

## First start

1. Copy `.env.local.example` to `.env`. Set a URL-safe random `DB_PASSWORD`, a separate random `API_JWT_SECRET` of at least 32 characters, and your Cloudflare Access team domain and application audience. Keep `.env` private.
2. Create the media directory and give the web container's UID permission to write it: `mkdir -p library && sudo chown 1001:1001 library`. Set `UPLOAD_LOCATION` in `.env` if you use another path.
3. Run `docker compose up --build -d`. The database initializes from `supabase/migrations/` on its first start. Check `docker compose ps` and `docker compose logs db api web`.
4. Add allowed users to the local database. For a new installation, use `docker compose exec db psql -U postgres -d postcard` and run `insert into auth.users(id,email,enabled) values (gen_random_uuid(), 'friend@example.com', true);` for each allowed Cloudflare email. For an import, enable the five imported emails instead: `update auth.users set enabled=true where lower(email) in ('friend1@example.com', ...);` and confirm `select id,email,enabled from auth.users;`. If a friend's Cloudflare email differs from their old Supabase email, update that user's email in this table while keeping their ID.

Cloudflare Access must protect **all paths** on the site. The app verifies `Cf-Access-Jwt-Assertion` against Cloudflare's rotating signing keys and the configured audience. The web port must remain reachable only through the trusted proxy or tunnel. PostgreSQL and PostgREST have no published ports. There are no app passwords or sign-in emails.

## Move an existing Supabase site

The production owner runs these steps. The agent never handles production credentials. Test the full sequence with the development Supabase project first.

1. Pause writes to the old site and take a source backup. Confirm the source has migrations through `0024` and no newer schema changes.
2. On a trusted machine with `pg_dump`, `psql`, and the Supabase CLI, link the CLI to the source project and run `SOURCE_DATABASE_URL='...' scripts/export-supabase.sh /private/export-dir`. The URL stays in your shell, outside the repo. The export contains `public.dump`, `users.csv`, and every object in the four Storage buckets. Keep the export private.
3. Start a **fresh** local Compose database with the new settings. Run `scripts/import-supabase.sh /private/export-dir`. It refuses a nonempty database, verifies media checksums, imports user IDs before application rows, and copies media. Compare source and destination row counts, then check representative cards, private cards, avatars, meetups, and files on disk.
4. Enable only the five intended emails in `auth.users`. Keep the existing domain, Cloudflare Access policy, VAPID keys, and `PUSH_SECRET` if you want existing phone subscriptions to continue. Otherwise ask users to turn notifications on again. Set the local `push_config.secret` to `PUSH_SECRET` using `docker compose exec db psql`, without printing the value in logs.
5. Switch the reverse proxy or tunnel to the new web container. Keep the old Supabase data untouched until the new site is accepted. If rolling back, pause writes again before switching traffic back; changes made after cutover are not automatically copied to Supabase.

The import intentionally does not copy Supabase password hashes or Storage metadata. The imported users keep their UUIDs, so postcard ownership and history remain linked. The Supabase CLI bulk Storage download uses its experimental `storage cp --recursive --remote` command. [Supabase Storage CLI](https://supabase.com/docs/reference/cli/supabase-storage-cp).

## Operations

Use `docker compose up --build -d` to update, `docker compose logs -f web` for logs, and `docker compose down` to stop. Do not use `down -v` during normal updates. Back up the PostgreSQL database with `pg_dump` and separately back up the media directory. A backup of PostgreSQL alone has no image bytes.

For a new installation with phone notifications, run `node scripts/push-keys.mjs https://your-site --env .env --sql push-setup.local.sql`, apply that SQL to the local database with `docker compose exec -T db psql -U postgres -d postcard < push-setup.local.sql`, then delete the SQL file and restart the web container. Keep the VAPID keys for the life of the site.
