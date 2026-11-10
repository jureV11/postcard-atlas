# Postcard Atlas spec

What the app does, the rules it must keep, and why things are the way they are.
Read this before changing anything. The code says *how*; these files say *what* and *why*,
so a new person (or a new AI agent) doesn't have to guess, and a new feature doesn't
quietly break an old one.

Start with the first two. They hold the rules that apply everywhere.

| File | What's in it |
|---|---|
| [principles.md](principles.md) | The rules every change must keep |
| [privacy.md](privacy.md) | Who can see what, and where that's enforced. **Read before touching postcard data** |
| [features/postcards.md](features/postcards.md) | A card's life: logged, in the post, arrived or lost; photos, editing, comments, private postcards |
| [features/map.md](features/map.md) | The Atlas page: flat map, globe, replay, map options |
| [features/stats.md](features/stats.md) | Leaderboard, nicheness, achievements, cards owed, year in review |
| [features/timeline.md](features/timeline.md) | Meetups: timeline, photos, write-ups, trips, stats |
| [features/groups.md](features/groups.md) | Accounts, groups, leaving, addresses |
| [features/inbox.md](features/inbox.md) | Inbox messages and phone notifications |
| [features/app-shell.md](features/app-shell.md) | Header, tab bar, phones, installable app, look and feel |
| [decisions.md](decisions.md) | Dated log of choices and the reason for each |

## Keeping it true

- **Every pull request that changes behaviour updates the spec in the same pull request.**
  New rule, changed limit, removed feature: change the file that describes it, and add a
  line to [decisions.md](decisions.md) if a choice was made.
- Write what must stay true and why, not a copy of the code. Point to the file where it lives.
- If the code and the spec disagree, don't silently pick one: ask, then fix whichever is wrong.
- Keep it short. A rule nobody reads protects nothing.
- Anything marked *(reason not written down)* was worked out from the code later.
  If you know the real reason, replace the note.
