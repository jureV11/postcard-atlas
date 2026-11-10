# Inbox and phone notifications

## Inbox (`/inbox`, in the avatar menu)

Table `inbox_messages` (`0020`), message kinds: `arrived`, `achievement`, `meetup`,
`comment` (`0024`). Most are written by database triggers, so they can't be skipped.

| Kind | Who gets it | When |
|---|---|---|
| `arrived` | The card's sender | The recipient marks it arrived |
| `meetup` | Each person added to a meetup | Someone adds them |
| `achievement` | You | You unlock an achievement (recorded on page load) |
| `comment` | The card's sender, recipient and earlier commenters who can see it | A new comment, never to its writer |

- An unread count shows as a red badge on the avatar.
- The envelope toggles read/unread; the bin deletes with Undo (soft delete).
- Opening a message goes through `/inbox/open/[id]`, which marks it read and redirects
  with a **relative path** (`lib/redirect.ts`), because behind the live server's proxy an
  absolute one pointed at `0.0.0.0:3000` (#51). Only plain paths on the site are allowed.
- A message about a meetup or card deleted since stays in the inbox with a note,
  instead of "page not found".
- Achievement messages open the profile with achievements unfolded and the new one highlighted.
- When adding a kind: replace the `inbox_messages` kind check in a new migration (drop any
  check that limits `kind`, whatever its name, then add the full list), and teach the
  inbox page its icon and link.

## Phone notifications (web push, `0017`, `lib/push.ts`)

- Off until the server is set up (`VAPID_*` keys and `PUSH_SECRET`, see `HOSTING.md`);
  without them nothing is sent and nothing breaks.
- Each person turns them on per device (Profile → Notifications). iPhone needs the app
  added to the Home Screen (iOS 16.4+).
- Sent only from the server, after the response (`after()`), and a failed notification
  never breaks the action that caused it.

| Notification | To |
|---|---|
| 📬 Your postcard arrived! | The sender |
| 🗺️ New postcard on the map | Everyone else still in the group, only when the card is public |
| 💬 New comment | Same people as the `comment` inbox message |
| Added to a meetup | Each person added |

**Never anything about a card still in the post.**
