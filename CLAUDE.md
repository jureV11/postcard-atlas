# Working on Postcard Atlas

A private postcard log for a small group of friends: Next.js 15 (App Router), React 19,
TypeScript, Tailwind v4, Supabase (auth, Postgres with row-level security, storage),
d3-geo for the flat map and react-globe.gl for the globe. Real friends use the live site
every day, so stay careful. How to set up and contribute is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Hard rules

- **Never touch production.** Only use a test Supabase project in `.env.local`. Never ask for,
  use or write down the production keys or the `service_role` key. If something can only be
  checked on production, say so and let the person do it.
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
- **No secrets in git.** `.env.local` and `*.local.sql` stay ignored.
- **Server code must not call helper functions from `"use client"` files.** It crashes at
  runtime, and neither the type-check nor the build notices. Put plain helpers in `lib/`;
  client files export only components and hooks. `npm run check:client` catches this.
- **Never push to `main` directly.** Work on a branch and open a pull request.
- Don't commit or push unless the person asks you to.

## Before calling a change done

```bash
npm run typecheck
npm run check:client
npm run build
```

All three must pass; CI runs the same checks on every pull request. `next build` and `tsc` can
rewrite `tsconfig.json`; if `git status` shows it changed, restore it with
`git checkout -- tsconfig.json`. Then look at the change in the browser on `npm run dev`
(http://localhost:3000), signed in with a test account.

## Style

- Plain, friendly English in the UI. The look is a paper travel journal (see `app/globals.css`).
- Match the surrounding code: naming, comment density, Tailwind classes.
- The app is used a lot on phones: check narrow screens too.
- Preserve each file's line endings (some files are CRLF).

## Pull requests

Say what changed and how it was tested. If there is a new migration, put **"Needs migration
00XX"** at the top: it must be run on the production database *before* the live server is
updated, or the site breaks.
