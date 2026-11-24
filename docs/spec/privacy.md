# Privacy: who can see what

The most important rules in the app. Data rows are protected **in the database**
(`supabase/migrations/`), and the local media route checks the same visibility for files. When you touch postcard
data, check the rule here and the SQL that enforces it.

## Postcards

A card is visible to a member of its group when **any** of these is true
(`postcard_feed` view, latest definition in `0019_hand_delivered.sql`):

| Who | When they see it |
|---|---|
| Its sender | Always, from the moment it's logged |
| Its recipient | Once they've marked it arrived (`status = 'received'`) |
| Everyone in the group | Once it's **public**: `postcard_is_public()` |

**Public** (`postcard_is_public`, latest in `0015_lost_postcards.sql`): the card is arrived or
lost, **and** no other card from the same sender posted within 10 days of it is still in
the post. That's the *trip rule*: cards from one trip are revealed together, once the last
one is in. Until then an arrived card is seen only by its sender and its recipient.

What this means in practice:

- A card in the post doesn't exist for anyone but its sender: no route, no count, no
  "something is on its way", no pulsing ring on the live map.
- Whole rows are hidden, not just some columns. Photos on the local filesystem follow the same rule.
- The table `postcards` can't be read directly: reads go through `postcard_feed`, writes
  through `security definer` functions that check who you are.

### Marking a card arrived without spoiling it

The recipient can't see what's on its way, so they can't pick a card from a list.
"A postcard arrived!" asks who it's from (the signature) **and** the country (the stamp),
and the database finds the match (`0006`, `0008`). A wrong guess just says "no match" and
reveals nothing. With two matches, the one travelling longest wins.

### Things built on top of postcards

Each must use the same rule, never a looser one:

- **Reactions and comments** (`0024`): `postcard_visible_to(card, member)` mirrors the feed
  rule for any member; `postcard_open_for_chat` also requires the card to be out of the
  post (arrived or lost). A card in the post can't be reacted to or commented on.
  Comment notifications only go to people who can see the card.
- **Notifications**: never anything about a card in the post. See [features/inbox.md](features/inbox.md).
- **Cards owed** (`lib/owe.ts`): only counts what you can see: cards you received, and
  your own cards. A friend's card on its way to you can't count, or it would give it away.
- **Stats, achievements, year in review, nicheness**: arrived *and* public only
  (see [principles.md](principles.md)), so nobody's numbers move because of a hidden card.
- **Replay**: shows in-transit routes and "on its way" rings, but only for cards that are
  public now, so it never shows anything that's still a secret.

## Other private things

- **Private postcards** (`private_postcards`, `0020`): cards sent to or from people outside
  the group. Only their owner can ever see them: not the group, not the map, not stats.
  The `private-postcards` media directory is owner-only through the media route too.
- **Addresses** (`member_addresses`, `0012`): readable by your group only, editable by you
  only, through functions that check it's yours.
- **Phone notification subscriptions** (`push_subscriptions`, `0017`): nobody can read the
  table. Only the server can look them up, by proving it knows `PUSH_SECRET` from its
  settings. The secret never reaches a browser.
- **Group data in general**: everything is scoped to `my_group_id()`. People in another
  group see nothing. Avatars live on disk at `avatars/<group_id>/<user_id>/…`, readable by the group.

## Secrets

- Development uses test data. Live operations follow the user's current authorization.
  Credentials stay in private configuration and are never printed or committed. All application
  data lives in local PostgreSQL and the media directory on the server.
- Cloudflare Access identifies users by verified email. Only enabled local identities can use the app.
- `.env.local`, `.env` and `*.local.sql` (e.g. push setup) stay out of git.
