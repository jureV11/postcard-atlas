# Helping with Postcard Atlas

You can run your own test copy of the site, make changes (by hand or with Claude), and send
them to the live site. Your test copy uses its **own** database, so nothing you try can break
anyone's real postcards.

## 1. One-time setup

Install Docker and Docker Compose. Copy `.env.local.example` to `.env`, fill in the local database secrets and a test Cloudflare Access application, then run `docker compose up --build -d`. Create test identities in `auth.users` as explained in [HOSTING.md](HOSTING.md). Use fictional postcards and media. Do not use the live Supabase project for development.

## 2. Making a change with Claude

Open Claude Code in the project folder. Claude reads [CLAUDE.md](CLAUDE.md) on its own, which
has the house rules. Start a session by pasting this, with your idea at the end:

> Read CLAUDE.md, CONTRIBUTING.md and docs/spec/ first. Then make a new branch from the latest `main`
> and help me with the change below. Test it on my local Compose stack, run the three checks in CLAUDE.md, update docs/spec/ for anything that changed, and
> show me what changed. When I'm happy, commit,
> push the branch and open a pull request. If it needs a database change, write a new additive
> migration, test it on the local database, and mark the pull request "Needs migration".
>
> My change: …

## 3. Getting it onto the live site

1. **Open a pull request** (Claude can do it). GitHub runs the checks automatically: wait for
   the green tick.
2. **Merge it** into `main`, after a quick look from someone else if it's a big change.
3. **New migration?** Ask the server owner to run it on the local production database before updating the web image.
4. **Tell Alex to update the server** (`git pull` and restart, see [HOSTING.md](HOSTING.md)).
   Until then the live site keeps running the old version.

## Good to know

- Keep each pull request to one thing; it's easier to check and to undo.
- Bugs and ideas can also go in [Issues](../../issues) if you'd rather not code them.
