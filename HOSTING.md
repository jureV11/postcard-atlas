# Hosting Postcard Atlas

## Atlas server with rootless Podman

The live site is `https://postcard.alexmagnus.uk/`. Connect with an SSH key as
`atlas@t.alexmagnus.uk` and work in `/mnt/docker/postcard-atlas`. The stack runs under
Atlas's rootless Podman account. Docker Compose is the installed provider at
`/usr/libexec/docker/cli-plugins/docker-compose`.

### Authorization and permissions

Live deployments, restarts, and SQL migrations follow the user's current authorization.
Honor a read-only request by using inspection commands only. All live-server work is
confined to `/mnt/docker/postcard-atlas`, including the account's home at `.atlas-home/`,
and the documented Atlas rootless stack. Treat the rest of the server as infrastructure
provided by the owner. Agents must not modify or attempt to repair host configuration,
accounts, packages, networking, SSH, proxies, Cloudflare infrastructure, the host Docker
daemon, or unrelated services. Use the installed tools and documented Atlas user-service
controls. Report infrastructure problems to the owner, who handles host administration.
Continue independent Atlas work where possible. Agents must not use sudo or attempt
host-level repairs. The Docker installation instructions later in this document apply
to separate installations, and do not authorize host setup on the live server.
The account has no sudo privileges or host Docker socket access. SSH password authentication
is disabled, and `atlas` is included in the server's SSH account allowlist.

### Deploy an authorized revision

```bash
ssh atlas@t.alexmagnus.uk
cd /mnt/docker/postcard-atlas
git status --short
git branch --show-current
# Pull or switch to the requested revision, preserving existing local changes.
# Apply any authorized numbered SQL migrations needed by that revision first.
./scripts/deploy-rootless.sh
podman ps
curl --fail --silent http://127.0.0.1:3020/api/health
```

The deployment script builds through native Podman with `--format docker` to preserve the
image health check. It starts the stack through Docker Compose using `docker-compose.yml`,
`compose.podman.yml`, and `.env`, and waits for health checks. Native builds handle private
directories excluded by `.dockerignore` that the installed Compose build client failed to
scan. Use this script for live rebuilds. It needs no sudo and does not apply SQL migrations.
The stack has PostgreSQL, PostgREST, and Next.js containers named `postcard-atlas-db-1`,
`postcard-atlas-api-1`, and `postcard-atlas-web-1`.

### Startup, status, logs, and restart

Run these as `atlas`.

```bash
systemctl --user status postcard-atlas.service --no-pager
systemctl --user is-enabled postcard-atlas.service podman.socket postcard-atlas-health.timer
loginctl show-user atlas -p Linger
podman info --format 'rootless={{.Host.Security.Rootless}}'
podman ps
podman logs --tail=100 postcard-atlas-web-1
journalctl --user -u postcard-atlas.service -n 100 --no-pager
```

`postcard-atlas.service` starts the Compose stack at boot. `podman.socket` enables the
rootless API used by Compose. `postcard-atlas-health.timer` runs database and web health
checks every 15 seconds through `postcard-atlas-health.service`, because the installed
Podman API failed to register its own health timers. Lingering is enabled so services start
before SSH login and survive logout. The units and enablement links live under
`.atlas-home/.config/systemd/user/`.

An authorized `systemctl --user restart postcard-atlas.service` restarts the existing image.
Use `./scripts/deploy-rootless.sh` to rebuild after source changes. A full service restart
was verified during migration on 2026-11-24. Startup across an actual host reboot awaits
verification. Rebooting the host affects other services and requires the user's approval.

### Active data and database migrations

`.env` selects the active data locations. At cutover they were
`.podman-data/postgres-live` for PostgreSQL and `.podman-data/library-live` for media.
Inspect actual mounts without printing credentials when checking current locations.

```bash
podman inspect --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' postcard-atlas-db-1 postcard-atlas-web-1
```

PostgreSQL and PostgREST have no published host ports. The web service uses
`127.0.0.1:3020`, reached through the existing proxy/tunnel and Cloudflare Access.
For interactive database access and authorized numbered migrations, use:

```bash
podman exec -it postcard-atlas-db-1 psql -U postgres -d postcard
# Replace NNNN_name.sql with the approved numbered migration.
podman exec -i postcard-atlas-db-1 psql -U postgres -d postcard -v ON_ERROR_STOP=1 < supabase/migrations/NNNN_name.sql
```

The PostgreSQL login above administers only the container's database instance. Application
requests use PostgREST with the existing RLS rules. Existing databases do not rerun the init
scripts on restart. Apply pending migrations in number order before deploying code that
needs them. Back up the database first. Never use migrations or ad hoc tests to erase live
data. Rootless UID mapping matters for file ownership, so use `podman unshare` or a
container operation when adjusting the active data directories.

### Backups and retained Docker data

Keep `.env`, `.atlas-home/`, `.podman-data/`, `.podman-migration/`, and migration exports
private and excluded from Git and image builds. Preserve the secrets in `.env` across
updates. Preserve ignored data and the account home during Git cleanup. Do not run
`git clean -fdx` in this checkout. Backups belong inside the authorized project directory, for example
`.podman-data/backups/`. A database dump can be taken with:

```bash
mkdir -p .podman-data/backups
podman exec postcard-atlas-db-1 pg_dump -U postgres -d postcard --format=custom > .podman-data/backups/postcard-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Also back up the media and configuration privately. Pause application writes when taking
a database/media snapshot that must agree exactly. A raw copy of running PostgreSQL files
is insufficient as a database backup. The final Docker-to-Podman snapshot is under
`.podman-migration/final/`, with a full database dump, row hashes, and media archive.
All database table contents and 163 media files matched at cutover.

The original `postgres/` and `library/` directories and old Docker containers are retained
migration artifacts. The old containers are stopped with automatic restart disabled.
They are a snapshot of the old system and do not receive new application writes. Recovery
or rollback must account for data created since cutover. Preserve those artifacts until
the owner authorizes cleanup. Normal deployments operate on the active rootless stack.

## Fresh Docker installations on other servers

Postcard Atlas runs with Docker Compose: Next.js, PostgreSQL, and an internal PostgREST API. Photos live in `UPLOAD_LOCATION`; PostgreSQL files live in `DB_DATA_LOCATION`. Back up **both** directories. Only the web port is published, on loopback, for your Cloudflare-protected reverse proxy or tunnel.

### First start

1. Copy `.env.local.example` to `.env`. Set a URL-safe random `DB_PASSWORD`, a separate random `API_JWT_SECRET` of at least 32 characters, and your Cloudflare Access team domain and application audience. Keep `.env` private.
2. Create the media directory and give the web container's UID permission to write it: `mkdir -p library && sudo chown 1001:1001 library`. Set `UPLOAD_LOCATION` in `.env` if you use another path.
3. Run `docker compose up --build -d`. The database initializes from `supabase/migrations/` on its first start. Check `docker compose ps` and `docker compose logs db api web`.
4. Add allowed users to the local database. Use `docker compose exec db psql -U postgres -d postcard` and run `insert into auth.users(id,email,enabled) values (gen_random_uuid(), 'friend@example.com', true);` for each allowed Cloudflare email. Confirm the mapping with `select id,email,enabled from auth.users;`. When changing an existing person's email, preserve their user ID so their history stays linked.

Cloudflare Access must protect **all paths** on the site. The app verifies `Cf-Access-Jwt-Assertion` against Cloudflare's rotating signing keys and the configured audience. The web port must remain reachable only through the trusted proxy or tunnel. PostgreSQL and PostgREST have no published ports. There are no app passwords or sign-in emails.

### Operations for a fresh Docker installation

Use `docker compose up --build -d` to update, `docker compose logs -f web` for logs, and `docker compose down` to stop. Do not use `down -v` during normal updates. Back up the PostgreSQL database with `pg_dump` and separately back up the media directory. A backup of PostgreSQL alone has no image bytes.

For a new installation with phone notifications, run `node scripts/push-keys.mjs https://your-site --env .env --sql push-setup.local.sql`, apply that SQL to the local database with `docker compose exec -T db psql -U postgres -d postcard < push-setup.local.sql`, then delete the SQL file and restart the web container. Keep the VAPID keys for the life of the site.
