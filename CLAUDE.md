# Working on Postcard Atlas

A private postcard log for a small group of friends: Next.js (App Router), React 19,
TypeScript, Tailwind v4, local PostgreSQL with row-level security, filesystem media,
Cloudflare Access identity, and Compose (rootless Podman on the live server),
d3-geo for the flat map and react-globe.gl for the globe. Real friends use the live site
every day, so stay careful. How to set up and contribute is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Read the spec first

[docs/spec/](docs/spec/README.md) says what every feature does, the rules it must keep and
why things are the way they are. Read [principles.md](docs/spec/principles.md) and
[privacy.md](docs/spec/privacy.md) before any change, and the feature file for the part
you're touching. **Every pull request that changes behaviour updates the spec in the same
pull request**, plus a line in [decisions.md](docs/spec/decisions.md) when a choice was made.
If the code and the spec disagree, ask instead of picking one.

## Hard rules

- **Use test data for development.** Live server deployments and migrations require the user's authorization.
  Follow authorization and read-only limits already given in the current conversation.
  The app uses local PostgreSQL, filesystem media, and Cloudflare Access identity.
  Keep credentials out of tracked files and tool output.
- **Database changes are new, numbered migrations** in `supabase/migrations/` (next number
  after the highest one there). They must only *add*: never drop or rename a column or table
  that holds data, never delete rows. Make them safe to run twice (`if not exists`,
  `create or replace`, `drop policy if exists` before re-creating a policy). If a change seems
  to need dropping or renaming something, stop and ask the person first.
- **When a view is rebuilt** (for example `postcard_feed`), start from its latest definition
  in the newest migration that touches it, so no columns go missing.
- **Keep surprises safe.** Nothing about a card in transit (sender, origin, photos) may reach
  anyone but its sender until it is revealed. This is enforced in the database (RLS, the
  `postcard_feed` view, `postcard_is_public`), so check those whenever postcard data changes.
- **No secrets in git.** `.env`, `.env.local` and `*.local.sql` stay ignored.
- **Server code must not call helper functions from `"use client"` files.** It crashes at
  runtime, and neither the type-check nor the build notices. Put plain helpers in `lib/`;
  client files export only components and hooks. `npm run check:client` catches this.
- **Never push to `main` directly.** Work on a branch and open a pull request.
- Run and test the app through Compose with Docker or rootless Podman; other run modes are unsupported.
- Don't commit or push unless the person asks you to.

## Live server access and deployment

The server is `t.alexmagnus.uk`, the SSH account is `atlas`, and the project is
`/mnt/docker/postcard-atlas`. SSH authentication uses keys. The account runs its own
rootless Podman containers with Docker Compose as the provider. Read [HOSTING.md](HOSTING.md#atlas-server-with-rootless-podman)
for the full runbook.

For an authorized deployment, inspect `git status --short` and the current branch first.
Preserve uncommitted server changes. Pull or switch to the requested revision, apply any
authorized numbered SQL migrations before the new web image, then run:

```bash
ssh atlas@t.alexmagnus.uk
cd /mnt/docker/postcard-atlas
./scripts/deploy-rootless.sh
podman ps
curl --fail --silent http://127.0.0.1:3020/api/health
```

Use `systemctl --user` for `postcard-atlas.service`, `podman.socket`, and
`postcard-atlas-health.timer`. A restart uses the existing image. The deployment script
builds a new image and starts it. Use the rootless script for live deployments.

The active database and media are selected by `.env`, currently
`.podman-data/postgres-live` and `.podman-data/library-live`. Keep `.env`, `.atlas-home`,
`.podman-data`, and `.podman-migration` private and excluded from Git and image builds.
The original `postgres/`, `library/`, and stopped Docker containers are retained migration
artifacts. Read `.env` paths without printing its secrets before backup or recovery work.
Preserve ignored live data and the account home during Git operations. `git clean -fdx`
would remove these directories and must not be used in the server checkout.

All live-server work is confined to `/mnt/docker/postcard-atlas` and the documented Atlas
rootless stack. Treat the rest of the server as infrastructure provided by the owner.
Do not modify or attempt to repair host configuration, accounts, packages, networking,
SSH, proxies, Cloudflare infrastructure, the host Docker daemon, or unrelated services.
Use the provided tools and documented Atlas user-service controls. If infrastructure is
missing or broken, report the problem and let the owner resolve it. Continue independent
Atlas work when possible. Do not use sudo or attempt host-level repairs.
Restarting or rebuilding the stack can briefly interrupt the site.

## Before calling a change done

```bash
npm run typecheck
npm run check:client
npm run build
```

All three must pass; CI runs the same checks on every pull request. `next build` and `tsc` can
rewrite `tsconfig.json`; if `git status` shows it changed, restore it with
`git checkout -- tsconfig.json`. Then look at the change through the Compose stack with a test Cloudflare Access identity.

## Style

- Plain, friendly English in the UI. The look is a paper travel journal (see `app/globals.css`).
- Match the surrounding code: naming, comment density, Tailwind classes.
- The app is used a lot on phones: check narrow screens too.
- Preserve each file's line endings (some files are CRLF).

## Pull requests

Say what changed and how it was tested. If there is a new migration, put **"Needs migration
00XX"** at the top: it must be run on the production database *before* the live server is
updated, or the site breaks.
