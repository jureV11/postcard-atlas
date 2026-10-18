# Hosting Postcard Atlas

Thanks for hosting! This is a Next.js website in one Docker container. The
database, sign-ins and photo storage live on **Supabase** (hosted, already set
up), so there's no database to run — just this one container.

Works on any machine with Docker + Docker Compose (Linux, macOS, Windows; x86 or ARM / Raspberry Pi).

## 1. Add the settings file

Create a file called **`.env.local`** (or **`.env`** — either works) in this folder (next to `docker-compose.yml`)
with the two values you were sent:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

(`.env.local.example` shows the format, plus an optional extra setting.) The key is Supabase's *public* key — it's
safe in the browser; the database's own security rules protect the data.

## 2. Start it

```bash
docker compose --env-file .env.local up --build -d
```

First build takes a few minutes. The site is then on **port 3000**.

- Using `.env` instead? Then it's just `docker compose up --build -d` — Docker reads `.env` by itself.
- With `.env.local`, `--env-file .env.local` is required: these values are compiled into the site
  at build time, and the build stops with a message if they're missing.
- Port 3000 taken? Add `HOST_PORT=8080` (or any free port) to your settings file — no need to edit
  `docker-compose.yml`, so updates never clash with your setup.
- It restarts by itself after a reboot (`restart: unless-stopped`).

## 3. Put it behind HTTPS

Expose it through your usual reverse proxy with a real domain and HTTPS
(phones need HTTPS for some features, e.g. copying invite links). For example
with Caddy:

```
postcards.example.com {
    reverse_proxy localhost:3000
}
```

## 4. Send back the address

Tell the site owner the final URL (e.g. `https://postcards.example.com`). They
need to add it in **Supabase → Authentication → URL Configuration** — otherwise
sign-in emails (password reset, new accounts) will link to the wrong place.

## Updating

When you get a new version, `git pull` (or replace the files, keeping your settings file) and run the
same command again:

```bash
docker compose --env-file .env.local up --build -d
```

## Phone app and notifications (optional)

The site can be installed on phones: **Add to Home Screen** (iPhone: Share button in
Safari; Android: Chrome menu). That needs nothing on the server.

Phone notifications ("your postcard arrived", "a new card is on the map") need a
one-time setup, because they use keys only this server knows:

1. Make the keys. In this folder, with Node installed:

   ```bash
   node scripts/push-keys.mjs https://postcards.example.com --env .env --sql push-setup.local.sql
   ```

   No Node on the server? The same through Docker:

   ```bash
   docker run --rm -v "$PWD":/app -w /app node:22-alpine node scripts/push-keys.mjs https://postcards.example.com --env .env --sql push-setup.local.sql
   ```

   Use your real site address, and your settings file's name (`.env` or `.env.local`).
   This adds four lines to that file and writes `push-setup.local.sql`. Nothing secret
   is printed; keep both files out of git and chat.
2. Run `push-setup.local.sql` in **Supabase → SQL Editor** (after migration 0017), then delete the file.
3. Restart with the usual `docker compose … up --build -d`.

Then everyone can switch notifications on under **Profile → Notifications**. Android
works in Chrome straight away; on iPhone (iOS 16.4+) the site must be added to the
Home Screen and opened from there first.

## Useful commands

```bash
docker compose logs -f web   # watch the logs
docker compose ps            # status (shows "healthy" once it's up)
docker compose down          # stop it
```
