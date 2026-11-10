# Stats, leaderboard and achievements

Everything here counts **only arrived, public cards** (see [../principles.md](../principles.md)),
so it's the same for everyone and spoils nothing. Lost cards don't count. Cards with an
unknown arrival date or handed over in person count, but not in anything about timing.

## Leaderboard (`/leaderboard`)

- Ranked by countries; the **same number of countries shares a rank**, and farther km is
  listed first within it (`rankMembers` in `lib/stats.ts`).
- Group passport: totals, km as laps of the Earth and the trip to the Moon *and back*,
  longest and shortest journeys, pen pals, average km per card.
- Postcards **by year** posted, not by month (monthly bars looked empty). With more than
  10 years, the latest 10 show and a slider goes back.
- Achievements leaderboard: who has the most badges, shared places on ties, rarest first.
- A button to the year in review.

## Nicheness

How off the beaten path a card's town is, out of 100. Settings in `lib/niche.config.ts`
(the only place to tune it), scoring in `lib/niche.ts`, breakdown shown with a tap.

| Factor | Points | Source |
|---|---|---|
| Rarely visited country | 35 | World Bank tourist arrivals, bundled in `lib/data/tourism.json` |
| Far from the group | 25 | Km to the nearest friend's home, log scale (150 km → 6,000 km) |
| Small place | 20 | GeoNames population via Open-Meteo, cached 30 days; ≤ 5,000 people scores full |
| Out on an island | 20 | Km out to sea to the nearest mainland (`lib/islands.ts`, Natural Earth land); land ≥ 120,000 km² is mainland, so Great Britain, Java and Honshu count |

- It depends **only on the town**, never on who sent it or how many cards came from there.
- A factor with no data is dropped and the rest scaled up to 100. Nothing is guessed.
- Known gap: no tourism data for North Korea, Taiwan and Kosovo.
- History of the formula: v1 → v4 in [../decisions.md](../decisions.md). Every change
  shifts everyone's scores, so say so in the update message.

## Achievements

- Personal ones in `lib/achievements.ts` (shown on profiles as inked seals, with progress
  bars for ones not earned yet, secret ones hidden until earned, "New" for 7 days).
  Group ones, earned together, in `lib/groupAchievements.ts` (Group page).
- Worked out from cards on every page load; newly earned ones are stored
  (`member_achievements`) so they can land in the inbox once.
- Removing one: delete it from the list and its seal icon in `components/AchievementSeal.tsx`.
  Old inbox messages about it must still open the profile without errors.

## Cards owed ("Your turn to write")

`lib/owe.ts`, shown on the Atlas page (full list) and on profiles (one line with that
friend). For each friend still in the group: cards they sent you that arrived, against
cards you sent them (arrived, lost or still in the post, so you don't owe twice).
Their cards still on the way to you can't count: that would give them away.

## Year in review (`/review`)

`lib/yearReview.ts`: the year's totals, cards per month, farthest/fastest/slowest,
awards (Busiest pen, Globetrotter, Fullest mailbox, Pen pals of the year; a pair only
counts if both wrote), countries with new ones starred, a row per person, meetups.
It opens on the current year, **except all through January**, when it opens on the year
that just ended (`defaultReviewYear`). Older years are a tap away.
