# Accounts, groups and addresses

Tables and rules from `0001` (groups, members), `0010`/`0011` (leaving), `0012`–`0014`
(addresses). Code in `lib/members.ts`, `lib/addresses.ts`, `app/onboarding/`,
`app/join/[code]/`, `app/(app)/(narrow)/group/`, `components/atlas/AddressesPanel.tsx`.

## Accounts and groups

- Sign in with email and password (Supabase auth); password reset by email link.
- **One group per account.** After signing up you start a group or join one with its
  invite code (`/join/<code>` shows who you're about to join first).
- Each member has a display name, a colour (no two the same in a group), an avatar and a
  home. Profiles are at `/members/<id>`; editing is under Settings.
- The Group page shows the members, the invite code and the group achievements.

## Leaving a group (`0011`)

- Leaving **keeps your postcards**: your member row stays (name, colour, cards) and shows
  as "(former member)". Your account is detached so you can join or start another group.
- Rejoining the same group with its invite code gives you the old row back, with everything.
- The owner role passes to the longest-standing remaining member.
- Former members don't count in "cards owed" and get no "new postcard" or comment notifications.
- *Why:* removing a member used to delete other people's cards along with theirs.

## Addresses (`0012`–`0014`)

- Up to **5 active addresses** per person. The limit lives in one function,
  `address_limit()`, so changing it is a one-line migration.
- Exactly one is **current**; it's the home on the map, and `members.home_*` is kept in sync
  with it.
- The address is **free text**, written exactly as on a postcard (several lines allowed).
  Its map position comes from picking the town with the city search, so fixing the text
  never moves anything on the map.
- Every postcard remembers the address it was sent to. So an address that cards were sent
  to **can't be deleted**, only **retired**: hidden from your list and the pickers, not
  counted in the limit, still on the map for those cards ("Bring back" undoes it).
- Such an address can only be corrected **within 25 km**, so editing it can't quietly move
  every old card's route to a new home.
- Your group can read everyone's addresses; only you can change yours.

## Profiles

Passport-style stats, separate Sent and Received boxes (lost cards noted under Sent),
achievements (foldable, newest first), cards owed with that person, and a map of their
cards. Tapping the avatar replays a flag burst in their home country's flag (a special
flag for names listed in the server setting `PRIDE_FLAG_NAMES`).
