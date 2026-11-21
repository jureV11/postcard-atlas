# Postcard Atlas

A private postcard log for a group of friends. Everyone logs the postcards they send, and the recipient marks them as arrived. Every card ends up as a route on a shared world map: where it was posted, where it landed, and how long it took.

It's built for one small group, but anyone can run their own copy. Ideas, bug reports and fixes are welcome. See [Contributing](#contributing).

## What it does

- **Surprise mode.** A card stays invisible to everyone but its sender while it's in the post. Cards from the same trip are revealed together once they've all arrived.
- **Map and globe.** A flat map and a 3D globe show every delivered card as a route coloured like the origin country's flag. Each person has a house pin with their photo. Pick a person to see what they sent (solid lines) and received (dotted).
- **Replay.** Watch the group's whole postcard history play out in real travel time: 1 day, 1 week or 1 month per second, with a timeline you can drag.
- **Leaderboard.** Most countries, most kilometres travelled, and a *nicheness* score for the most off-the-beaten-path card. Tap a score to see how it was worked out.
- **Photos.** The recipient photographs the front and back when a card arrives. Tap the card to flip it over.
- **Addresses.** Up to 5 per person. Each card is linked to the address it was actually sent to, so moving doesn't rewrite history.
- **Lost in the post.** The sender can mark a card that never arrived as lost: its route stops part-way, with the bird sinking at sea or lost over land.
- **Achievements** on every profile, from countries and continents to a 60-day slow boat.
- **Phone app and notifications.** Add it to your Home Screen like an app, and get a ping when your card arrives or a new one is revealed (never about cards still on their way).
- **Leaving a group keeps your cards.** They stay on the map as a "former member", and rejoining with the invite code brings everything back.

## How it's built

- [Next.js](https://nextjs.org) 16 (App Router) with React 19 and TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- Docker Compose runs local PostgreSQL, PostgREST and Next.js. Images live on disk; Cloudflare Access identifies the five enabled users. Database access rules remain in the SQL migrations.
- [d3-geo](https://d3js.org/d3-geo) for the flat map, and [react-globe.gl](https://github.com/vasturiano/react-globe.gl) for the globe

### Nicheness score

Each card's score is out of 100 and depends only on the town it came from. The weights and limits are in [`lib/niche.config.ts`](lib/niche.config.ts):

| Factor | Points | Source |
|---|---|---|
| Rarely visited country | 35 | Tourist arrivals per year ([World Bank](https://data.worldbank.org)) |
| Far from the group | 25 | Distance to the nearest friend's home (the first few thousand km count the most) |
| Small place | 20 | Population from [GeoNames](https://www.geonames.org), via the [Open-Meteo](https://open-meteo.com) geocoder |
| Out on an island | 20 | How far out to sea the town is, to the nearest mainland ([Natural Earth](https://www.naturalearthdata.com) land shapes): nothing just off the coast, full from 600 km. Great Britain and other big islands count as mainland |

If a number can't be found, that factor is left out and the others share its points. No value is ever guessed. The tourism table is bundled in `lib/data/`. To rebuild it, run `node scripts/build-niche-data.mjs`.

## Running it yourself

This app runs through Docker Compose behind Cloudflare Access. Copy `.env.local.example` to `.env`, set the local database and Access values, then run `docker compose up --build -d`. Add allowed emails to `auth.users` as described in [HOSTING.md](HOSTING.md). PostgreSQL and media are persisted in separate host directories. The [hosting guide](HOSTING.md) also covers importing an existing Supabase site.

For code changes, run `npm run typecheck`, `npm run check:client`, and `npm run build`. Test behavior through the Compose stack.

## Contributing

**Found a bug or have an idea?** [Open an issue](../../issues/new/choose). There are short forms for bug reports and feature ideas. Screenshots help a lot.

**Want to fix or build something yourself?** [CONTRIBUTING.md](CONTRIBUTING.md) walks through running your own test copy and getting a change onto the live site, including with Claude Code ([CLAUDE.md](CLAUDE.md) has the rules it follows).

1. Fork the repo and create a branch.
2. Make your change. Keep it focused on one thing.
3. Run `npm run typecheck` and `npm run build`. Both must pass.
4. Open a pull request saying what you changed and how you tested it.

A few house rules:

- **Database changes go in a new numbered migration** in `supabase/migrations/`. Migrations must only add things: never drop or rename a column or table that holds data, and make them safe to run twice (`if not exists`, `create or replace`).
- **Keep surprises safe.** Nothing about a card in transit (who sent it, where from, photos) may reach anyone but the sender until it's revealed. This is enforced in the database, so check the access rules when you touch postcard data.
- **No secrets in the repo.** `.env` is ignored by git; keep it that way.
- **Server pages can't call functions from `"use client"` files.** Put plain helpers in `lib/`, and keep only components and hooks in client files.

## Licence

[MIT](LICENSE). Use it, change it, share it; just keep the copyright notice.
