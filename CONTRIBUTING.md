# Helping with Postcard Atlas

You can run your own test copy of the site, make changes (by hand or with Claude), and send
them to the live site. Your test copy uses its **own** database, so nothing you try can break
anyone's real postcards.

## 1. One-time setup

1. Install [Node.js 20+](https://nodejs.org), [Git](https://git-scm.com) and
   [Claude Code](https://claude.com/claude-code) (the desktop app or the terminal version).
2. Accept the GitHub invite to the repository, then download the code:
   ```bash
   git clone https://github.com/jureV11/postcard-atlas.git
   ```
3. **Make your own test database.** Create a free project at [supabase.com](https://supabase.com).
   In its **SQL Editor**, run every file in `supabase/migrations/` **in number order**
   (`0001`, `0002`, … up to the last one), each once.
   Then go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** off,
   so test accounts work straight away.
4. Copy `.env.local.example` to `.env.local` and fill in your test project's URL and its
   *anon* (or *publishable*) key from **Project Settings → API**. Never use the `service_role` key.
5. Start it:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, create an account, start a group, and log a few made-up
   postcards. To have "friends" in your test group, sign up again with `you+friend@gmail.com`:
   Supabase treats it as a different person, but the email still reaches you.

## 2. Making a change with Claude

Open Claude Code in the project folder. Claude reads [CLAUDE.md](CLAUDE.md) on its own, which
has the house rules. Start a session by pasting this, with your idea at the end:

> Read CLAUDE.md and CONTRIBUTING.md first. Then make a new branch from the latest `main`
> and help me with the change below. Test it on my local server (`npm run dev`, test database
> only), run the three checks in CLAUDE.md, and show me what changed. When I'm happy, commit,
> push the branch and open a pull request. If it needs a database change, write a new additive
> migration, tell me to run it on my test database, and mark the pull request "Needs migration".
>
> My change: …

## 3. Getting it onto the live site

1. **Open a pull request** (Claude can do it). GitHub runs the checks automatically: wait for
   the green tick.
2. **Merge it** into `main`, after a quick look from someone else if it's a big change.
3. **New migration?** Ask Jure to run it on the **production** database **before** the server
   is updated. Production keys are never shared, so this step is always his.
4. **Tell Alex to update the server** (`git pull` and restart, see [HOSTING.md](HOSTING.md)).
   Until then the live site keeps running the old version.

## Good to know

- Keep each pull request to one thing; it's easier to check and to undo.
- Bugs and ideas can also go in [Issues](../../issues) if you'd rather not code them.
