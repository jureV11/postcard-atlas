# Timeline and meetups (`/timeline`)

The times the group met up in person. Tables from `0020`, extended by `0021`–`0023` and `0026`.
Code in `components/Timeline.tsx`, `TimelineMap.tsx`, `TripMap.tsx`, `MeetupStats.tsx`,
`lib/meetups.ts`, `lib/meetupStats.ts`, `app/(app)/(narrow)/timeline/`.

## Who can do what (enforced in `0020`)

- Anyone in the group can add a meetup, change its details and add photos.
- A meetup can be deleted only by whoever added it.
- A photo can be removed by whoever added it **or anyone who was at that meetup**, so
  people can take down photos of themselves.
- Write-ups: one per person per meetup, signed, only the writer can edit or delete it.
  A write-up is dated when it was **first written** (`created_at`, which saving never
  changes). If it was edited on a later day, a small "edited <date>" follows, so adding a
  memory months later doesn't make the whole write-up look new, but changes still show.

## Limits

- At least **two people** per meetup (checked in `timeline/actions.ts`).
- Title up to 120 characters; titles show in full on the timeline (they wrap).
- Up to **50 photos** per meetup (`meetup_photo_limit()`), each with a caption, an order and a
  focus point for the main photo's crop on the timeline.
- Write-ups up to **200,000 characters** (`0022`). Text is tiny; the limit only guards
  against a huge accidental paste.

## The timeline

- To scale: months and years marked, scrolls sideways (wheel, ← →), full screen width.
- Meetups close in time sit side by side with bent stalks; they only stack as a last
  resort. Faint travel doodles fill long empty stretches.
- On phones it's newest first, and Timeline is in the tab bar.
- Search. Meetups can be linked to postcards about them (arrived public cards only).
- **Who was there** (#66): everyone who has been at a meetup, as avatar chips (most
  meetups first; scrolls sideways on its own on phones). Tap people to show only the
  meetups they were **all** at, on the line, in the search and on the map; with two or
  more picked, a switch chooses **Anyone else too** or **Just them** (nobody else there).
  "Show everyone" clears it. Hidden when only two people have ever met up. The stats
  underneath stay the whole group's.
- **Write-ups to do** (#67): above the line, the past meetups (started by today) you were
  tagged in and haven't written about yet, newest first, each linking to its write-ups.
  Only you see your own list (it's worked out from your write-ups, nothing is stored) and
  one leaves it as soon as you save a write-up. Meetups still to come never show. The Atlas
  shows the three newest between the leaderboard and the latest arrivals (#69). No inbox message or notification: it's a
  reminder you look at, not a nudge.

## Trips (`0023`)

A meetup can go through several places in order (Beijing → Xi'an → Shanghai). The
meetup's own city, country and coordinates stay the **first** place, so older meetups are
unchanged; `stops` holds the places after it. Cards, the timeline map and the places
stat count every stop.

**Flags (`0026`, #65).** A trip through several countries can pick which flags it shows
(one or several), in the edit form under the places: tap a country to turn its flag on or
off, at least one stays on. `flag_codes` holds the picked country codes; empty means
nobody picked, and it shows the first place's flag as before. Picked codes that are no
longer on the trip are ignored. The shown flags are also the countries the meetup counts
in the **Countries** stat, so a two-hour stop on the way neither stands for the trip nor
counts as a country visited (`meetupFlags` in `lib/meetups.ts`). The meetup page still
lists every stop with its flag. The form only sends `flag_codes` when there is something
to save, so meetups still save on a database that hasn't had `0026` yet.

**One meetup is one unbroken stretch together.** Travelling together counts, so a quick
meetup in Spain before flying on together, a trip round Asia, and a friend then staying a
few days at yours are all one meetup, with each place as a stop. If you split up and met
again later, that's a new meetup.

## Under the timeline

- Map of meetup places: a full pin where each meetup starts (a count when several share
  it); the later stops of a trip are **small numbered dots** on its dashed line, so one trip
  never looks like several meetups. Tapping a pin highlights its meetups' trips and fades
  the rest; the list says "Trip · N places". The heading counts meetups and places
  separately. Pins keep their size on phones. Pinch, buttons, Ctrl+scroll or
  the wheel zoom; a plain scroll past a zoomed-out map still scrolls the page.
- Stats: meetups, days together, places and countries, busiest year, by year, who comes
  most (shared ranks), travel buddies (every pair, the rest folded after six).

## Meetup page

Photos (main photo, full-screen viewer with zoom, swipe and arrow keys; drag to reorder,
hold-then-drag on phones), a trip map, and write-ups. Other people's write-ups start
**blurred like a spoiler** with a word count and a "Read …'s write-up" button; once read
it stays readable on that device (`localStorage`). Your own is never blurred.
Links in write-ups and captions work, bare or `[text](link)`, and so do `**bold**` and
`*italic*` (`components/Linkify.tsx`).
Dates use Day / Month / Year dropdowns, because the iPhone's own picker easily flips to
a month-and-year wheel.
