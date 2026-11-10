# Principles

The rules every change must keep. [CLAUDE.md](../../CLAUDE.md) has the working rules
(branches, checks, migrations); this file is about what the app itself must do.

## Who it's for

A private postcard log for one small group of friends who send each other real postcards.
Real people use the live site every day, mostly on phones. It's open source (MIT), so
others can run their own copy, but every choice is made for this one group first.

## The rules

1. **Surprises stay surprises.** A card in the post is invisible to everyone but its sender:
   not who sent it, not where from, not even that it exists. Cards from the same trip are
   revealed together. Nothing may leak this: not the map, stats, counts, notifications,
   comments, achievements or "cards owed". Details and enforcement: [privacy.md](privacy.md).

2. **One rule for what counts.** Stats, the leaderboard, achievements, nicheness, the year
   in review and the replay only count cards that have **arrived and are public**
   (`status = 'received'` and `is_public`). That keeps everyone's numbers the same and
   spoils nothing. Lost cards show on the map but don't count in stats.

3. **Never guess data.** If a number can't be found (a town's population, an arrival date),
   leave it out and say so ("Date unknown"); don't make one up. Nicheness drops a missing
   factor and shares its points among the rest.

4. **History doesn't get rewritten.** A card stays linked to the address it was sent to,
   even after someone moves. Leaving a group keeps your cards on the map as a
   "former member". Database migrations only add, never drop or rename anything holding data.

5. **The database is the guard, not the UI.** Who can see or change what is enforced with
   row-level security, views and `security definer` functions in `supabase/migrations/`.
   Hiding a button is never enough on its own.

6. **Phones first.** Every page must work at 375 px wide with the bottom tab bar. Check
   narrow screens for every change.

7. **Plain, friendly English, and a paper travel-journal look.** Ink header with an airmail
   strip, grainy paper, stamps, postmarks, handwriting (see `app/globals.css`).
   No jargon in the UI.

8. **Production is off limits to code and agents.** Only test Supabase projects are used in
   development. The live database is changed by a person running a migration by hand,
   *before* the live server is updated.

## Who does what

- **Jure** owns the repository and the production Supabase project.
- **Alex** hosts the live server (Docker behind a reverse proxy) and pulls updates by hand.
- **Oriol** contributes features and has access to the production Supabase project.
- Anyone can open issues; changes go through pull requests into `main`.
