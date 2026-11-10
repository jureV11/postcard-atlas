# App shell, phones and look

## Layout (`app/(app)/layout.tsx`)

- Every signed-in page shares the ink header (stamp logo, "Postcard Atlas", the group name
  in handwriting, the avatar menu) with an airmail strip under it.
- From `sm` (640 px) up the page links sit in the middle of the header.
  Below that, a **bottom tab bar** (`components/TabBar.tsx`): Map, Cards, the stamp-shaped
  "Log a postcard" button, Timeline, Ranks, Group.
- The map page can be up to 1720 px wide; every other page keeps a reading width
  (`app/(app)/(narrow)/layout.tsx`).
- Avatar menu (`ProfileMenu.tsx`): inbox (with unread count), your profile, edit profile,
  private postcards, sign out.

## Phones

- Most use is on phones: check every change at 375 px.
- The page uses the whole screen (`viewportFit: "cover"`), so the header pads for the
  status bar, the tab bar for the home indicator, and the page sides for the notch when the
  phone is sideways (`px-safe` in `globals.css`: at least 1rem, more where the notch is).
- **Nothing may make the page wider than the screen.** The app layout is clipped sideways
  (`overflow-x-clip`), because anything too wide let phones zoom the page out past the
  screen, leaving the header covering only part of the top (#44). Still keep things from
  overflowing: long text wraps (`break-words`), and wide content scrolls inside its own box.
- Full-width blocks on phones use `-mx-4` against the page's 1rem side padding.
- Inputs avoid the phone's own date picker where it misbehaves (see the timeline).

## Installable app

- "Add to Home Screen" gives a real app: name "Postcards", stamp icons, full-screen launch
  (`app/manifest.ts`, `public/`). Settings → "The app" has an Install button or iPhone steps.
- A service worker is registered on every page, with an offline page; it also receives
  push notifications.

## Look and feel

A paper travel journal: grainy warm paper, ink, stamp red (`--color-stamp`), airmail
stripes, postmarks, washi tape, handwriting (Caveat), Fraunces for headings, Inter for
text, JetBrains Mono for big numbers. Colours and fonts are in `app/globals.css`.
Confetti is hand-rolled (no library) and skipped with reduced motion.

## Code rules that bit us before

- Server code must not call helper functions from `"use client"` files: it crashed the
  live leaderboard and profile pages twice. Helpers go in `lib/`. `npm run check:client`
  and CI catch it.
- Text that depends on the browser (country names, dates) must be built the same on the
  server, or React reports a hydration mismatch (Falkland Islands, update #6).
