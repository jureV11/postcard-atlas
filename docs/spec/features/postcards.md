# Postcards

Who can see a card at each step is in [../privacy.md](../privacy.md). This file is about
what each person can do.

## A card's life

1. **Logged by the sender** (`/postcards/new`, or the stamp button in the phone tab bar):
   where and when it was posted, who it's for, which of their addresses, a message and a
   private note. `?to=<member id>` opens the form with that friend picked ("Log one →" in
   cards owed). Logging throws confetti with the origin country's flag.
2. **In the post** (`in_transit`): a secret from everyone but the sender. The sender can
   take it back (delete) only while it's in the post.
3. **Arrived**: the recipient uses "A postcard arrived!" (`/postcards/arrived`), matches it
   by sender and country, photographs front and back, and gives the arrival date, or ticks
   "I don't know when it arrived". The sender gets "Your postcard arrived".
4. **Public**: once the rest of its trip is in (the 10-day trip rule), everyone sees it on the
   map and in stats, and the group gets "New postcard on the map".

## Rules

- **Photos are the recipient's job**: they hold the card (`0005`). They add front and back
  while marking it arrived, and can replace them later. Exception: the **sender** may add photos to a *lost* card, since it never
  reached anyone (`0018`). Lost cards' photos show in black and white.
- **Editing** (`0007`): the sender can change where, when, message and note any time, and
  who it's for only while it's in the post. The recipient can change the arrival date and
  message, or undo "arrived" if they matched the wrong card: it goes back to being a
  mystery and its photos are detached (they belonged to the other card).
- **Lost in the post** (`0015`): only the sender can mark a card lost, or log an old one as
  "It never arrived". They give a "Gave up on" date (today by default, or one tap for
  100 days after sending; not before it was sent, not in the future) and can change it
  later. A lost card goes public under the same trip rule and shows as a route that stops
  part-way: a bird sinking at sea, or puzzled with a "?" over land. Lost cards **don't
  count in stats**. If it turns up, the recipient's usual arrival flow still finds it, or
  the sender can undo.
- **Hand delivered** (`0019`): the sender ticks it when the card was given in person. It's
  still a surprise until logged as arrived, but it's left out of time-in-the-post stats and
  shows "by hand" instead of a postmark.
- **Arrival date unknown** (`0016`): the card counts as delivered everywhere, but is left
  out of anything about timing (average days, fastest/slowest, replay, charts). No date is
  made up.
- A card is linked to the **address it was sent to** (`recipient_address_id`), so the route
  stays right after the recipient moves. See [groups.md](groups.md).

## Reactions and comments (`0024`)

- On cards that are out of the post (arrived or lost) and that you can see.
- Six fixed reactions: ❤️ 😍 😂 🤯 🔥 👏, each once per person; tap again to remove.
  Reactions notify nobody.
- Comments: 1–2,000 characters, links work, edit or delete your own.
- A new comment goes to the inbox and phones of the card's sender, its recipient and
  earlier commenters, only those still in the group who can see the card, and never to
  the person writing.
- While a card has arrived but its trip isn't public yet, the page warns that comments
  will be visible to everyone once it is.
- Code: `lib/postcardChat.ts`, `app/(app)/(narrow)/postcards/[id]/PostcardChat.tsx` and
  `chat-actions.ts`.

## Private postcards (`0020`, #23)

Cards someone sent to, or got from, people outside the group: photos, message, dates,
place, notes. Only their owner can see them: never on the map or in stats. Reached from
the avatar menu and from the log and arrived pages (`/private`).

## Postcards page (`/postcards`)

Group stats as the back of a postcard (average days in the post as a postmark,
fastest and slowest as luggage tags), postcards grouped by month with date stamps,
newest or oldest first, search by town, country, person, month or message (accents
ignored, only over cards you can already see), a "Lost in the post" row.
Each postcard page shows the country outline with the town marked, the flip-over photos,
the nicheness breakdown, reactions and comments.
