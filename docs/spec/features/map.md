# The Atlas (map page, `/`)

The home page: every card as a route on a shared world map. Code in `components/atlas/`,
data shaping in `lib/atlas.ts`.

## Layout

- Desktop: addresses on the left, the map in the middle (it takes all the extra width,
  page up to 1720 px), small stats on the right (280 px): cards owed, countries reached,
  mini leaderboard, latest arrivals.
- Phones: one column; the map is full width, edge to edge. "Log a postcard" is hidden next
  to the title because the tab bar's stamp button does it; "A postcard arrived!" stays.

## Two views

- **Globe** (default, `react-globe.gl`, three.js): loaded only when opened, because it's
  big. Countries sit just above the sea and flatten as you zoom; pins sit on the land;
  routes are tubes that get thinner as you zoom in so they look the same width on screen.
  Zoom buttons (+, −, fit) in the top-left.
- **Flat map** (`d3-geo`, `FlatMap.tsx`): redraws at most once per frame, pauses
  animations while moving, never lets place names overlap (most important placed first:
  selected, homes, towns, old addresses).
- The chosen view and every map option are remembered **per device** in `localStorage`.
  The keys carry a version (`atlas-view-v2`, `atlas-routes-v3`…); bump it when a new default
  must reach everyone once.

## What's drawn

- A route per arrived public card, coloured like the origin country's flag (up to three
  colours read from the flag image, with a dark edge so white stripes show). A swallow
  rides on routes. A dot where each card landed, in the sender's colour.
- Homes: the current address of each member, as a dot or a little house with their photo.
- Countries cards were sent from, hatched on the flat map.
- **Old addresses** only for the person picked in the filter, otherwise they crowd the map.
  An old address shows only once a delivered card went there.
- Lost cards: a dashed route that stops part-way, with the sinking or puzzled bird.

## Controls

- **Person filter** (chips above the map): their sent routes solid, received dotted, the
  rest faded, with "Sent by / Received by" tick boxes and counts. Never both off.
- **Map options** panel: Routes, Flag colours, Names, Houses, Colourful map. Defaults
  (since 29 Oct 2026): plain map, routes on, names on, dots for homes, flag colours on.
- **Replay**: the group's whole history in real travel time (1 day, 1 week or 1 month per
  second) with a draggable timeline. Routes grow from posting to arrival. It always runs on
  the flat map (smoother) and puts your view back when done. "On its way" rings only show
  here, as history, never live. Only arrived public cards with a known arrival date.
- Clicking a route, town or home opens a panel (`AtlasPanel.tsx`), at the bottom on phones.
