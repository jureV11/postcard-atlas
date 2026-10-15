# Hosting Postcard Atlas

Thanks for hosting! This is a Next.js website in one Docker container. The
database, sign-ins and photo storage live on **Supabase** (hosted, already set
up), so there's no database to run — just this one container.

Works on any machine with Docker + Docker Compose (Linux, macOS, Windows; x86 or ARM / Raspberry Pi).

## 1. Add the settings file

Create a file called **`.env.local`** in this folder (next to `docker-compose.yml`)
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

- `--env-file .env.local` is required: these values are compiled into the site
  at build time, and the build stops with a message if they're missing.
- Port 3000 taken? Change `"3000:3000"` in `docker-compose.yml` to e.g. `"8080:3000"`.
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

When you get a new version, replace the files (keep your `.env.local`) and run the
same command again:

```bash
docker compose --env-file .env.local up --build -d
```

## Useful commands

```bash
docker compose logs -f web   # watch the logs
docker compose ps            # status (shows "healthy" once it's up)
docker compose down          # stop it
```
