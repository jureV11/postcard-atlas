# Postcard Atlas

A private postcard log and map for a small group of friends.
Next.js (App Router) · TypeScript · Tailwind v4 · Supabase.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run each file in [`supabase/migrations/`](supabase/migrations/) in order
   (`0001_groups_members.sql`, then `0002_postcards.sql`, …).
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/**`
     (and `http://<your-PC-LAN-IP>:3000/**` if you'll test from your phone)
4. **Authentication → Emails → Magic Link** template: add the code so people can type it
   when the link opens in the wrong browser (common on phones). For example:

   ```html
   <h2>Sign in to Postcard Atlas</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```

   Do the same for the **Confirm signup** template — a brand-new email gets that one the first time.

> Supabase's built-in email sender is rate-limited to a few emails per hour, which is fine
> for 4 friends but easy to hit while testing. For more, plug in an SMTP provider under
> **Authentication → Emails → SMTP Settings** (e.g. Resend's free tier).

### 2. Environment

Copy `.env.local.example` to `.env.local` and fill in the project URL and anon/publishable key
(**Project Settings → API**).

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. To test from a phone on the same Wi-Fi: `npm run dev:lan`, then open
`http://<your-PC-LAN-IP>:3000` on the phone.

## Run with Docker

The database, sign-in and photo storage stay on Supabase; Docker runs the website.

```bash
docker compose --env-file .env.local up --build -d
```

Then open http://localhost:3000 (from a phone on the same Wi-Fi: `http://<PC-IP>:3000`, and add that
address to Supabase's redirect URLs). On Windows you can double-click **Start with Docker.cmd** instead.

- `--env-file .env.local` matters: the Supabase URL and key are baked into the browser code at build time.
- After changing code, run the same command again to rebuild.
- Stop it with `docker compose down`. It restarts by itself whenever Docker starts (`restart: unless-stopped`).

## How it works (step 1)

- **Sign in**: email magic link or 6-digit code (`/login`, `/auth/callback`).
- **Onboarding** (`/onboarding`): start a group (gets a 6-character invite code) or join one.
  Invite links look like `/join/ABC234`.
- **Members** each have a name, optional avatar, home city (searched via
  [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api)) and a unique colour.
- **Privacy**: every table has row-level security keyed on `my_group_id()`. Groups and
  memberships are only created through the `create_group` / `join_group` functions. Avatars
  live in a private bucket under `<group_id>/<user_id>/…` and are served with signed URLs.
- One group per person (enforced by a unique `members.user_id`).
