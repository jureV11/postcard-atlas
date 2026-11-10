# Decisions

Choices that shaped the app, newest first, with the reason. Add a line whenever a pull
request makes a choice someone might later wonder about. Issue numbers are GitHub issues.

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | The app layout is clipped sideways, and pinching the globe only moves the globe (#44) | On phones, pinching the globe zoomed the page, and anything too wide let it zoom out past the screen, so the header only covered part of the top |
| 2026-11-10 | `docs/spec/` is read first by every agent and updated in every pull request | Agents kept re-deriving why the code is the way it is, and could break old rules nobody mentioned |
| 2026-11-07 | The year in review opens on last year all through January | In January the year that just ended is the one people want to look back on |
| 2026-11-07 | Nicheness v4: "far from an airport" replaced by "out on an island" (km out to sea); weights tourism 35, distance 25 (log), population 20, island 20 | Being on an island usually means an airport nearby, so airport distance scored Vanuatu as *not* niche. Distance was overweighted |
| 2026-11-07 | Removed the "Lost at sea" achievement | Rewarding a lost card made no sense |
| 2026-11-07 | Reactions and comments follow exactly the card's own visibility, and only once it's out of the post | Anything looser would leak cards in transit |
| 2026-11-07 | "Cards owed" only counts what you can already see | Counting a friend's card on its way to you would spoil it |
| 2026-11-04 | Meetup dates use Day / Month / Year dropdowns (#35) | The iPhone's own picker easily flips to month-and-year only |
| 2026-11-04 | Redirects use relative paths (#51) | Behind the live proxy, absolute ones sent people to `0.0.0.0:3000` |
| 2026-11-04 | Other people's write-ups start blurred (#50) | Like a spoiler: read them when you choose to |
| 2026-11-04 | Trip stops stored after the meetup's own place (`stops`) | Every existing meetup stays exactly as it was |
| 2026-11-04 | Write-ups up to 200,000 characters (#47) | 4,000 was too short for long trips; text is tiny |
| 2026-11-04 | A meetup needs at least two people (#43) | A meetup with only yourself isn't a meetup *(guessed; see #43)* |
| 2026-11-03 | Up to 50 photos per meetup (#31), with captions, order and crop point | 10 was too few for real trips |
| 2026-11-02 | Inbox, written by database triggers | Messages can't be skipped by a page that forgets to send them |
| 2026-11-02 | Private postcards are owner-only and never on the map or in stats (#23) | They're to or from people outside the group |
| 2026-11-02 | A meetup photo can be removed by anyone who was there | People can take down photos of themselves |
| 2026-10-31 | Leaderboard chart by year, not month | Twelve monthly bars with a card or two looked empty |
| 2026-10-31 | Sign out from the avatar menu | It needed profile → edit → scroll; now two taps |
| 2026-10-31 | Globe uses one simplified 50 m map (Europe kept detailed, islets under 500 km² outside Europe dropped) | Countries built in ~0.8 s instead of ~12 s |
| 2026-10-29 | Hand delivered cards count, but not in time-in-the-post stats (#10) | They never spent time in the post |
| 2026-10-29 | Map defaults: plain map, routes, names and dots on (applied to everyone once by bumping the saved-setting keys) | A calmer, more readable map |
| 2026-10-29 | Nicheness v3: dropped Wikipedia views | They made places near big cities look obscure |
| 2026-10-22 | The sender may add photos to a lost card | It never reached the recipient, who normally takes the photos |
| 2026-10-22 | Old addresses and their countries only show for the person picked | They crowded the map |
| 2026-10-18 | Phone notifications never mention a card in the post; subscriptions unreadable except by the server | Surprises, and phone addresses must never reach other browsers |
| 2026-10-18 | "I don't know when it arrived" instead of a made-up date (#4) | Never guess data; such cards stay out of timing stats |
| 2026-10-18 | CI runs typecheck, the client-helper check and a build on every pull request | Server code calling helpers from `"use client"` files crashed the live site twice |
| 2026-10-16 | Lost postcards: sender marks them, they go public under the trip rule, don't count in stats | A lost card is no longer a surprise, but it wasn't delivered |
| 2026-10-16 | Address limit lives in one function, `address_limit()` (now 5) | Changing it is a one-line migration |
| 2026-10-16 | Addresses are free text, with the town picked separately for the map | Written as on a postcard; fixing the text never moves the map |
| 2026-10-15 | Addresses that cards went to are retired, not deleted, and only correctable within 25 km | Deleting or moving them would rewrite the history of those cards |
| 2026-10-15 | The replay always runs on the flat map | Routes grow far more smoothly there |
| 2026-10-15 | Nicheness depends only on the town; missing data is never guessed | Several cards from one country shouldn't cost anything, and made-up numbers mislead |
| 2026-10-15 | Routes in the origin country's flag colours | *(reason not written down)* |
| 2026-10-14 | Leaving a group keeps your cards as a "former member"; rejoining restores them | Removing a member used to delete other people's cards too |
| 2026-10-14 | Every card links to the address it was sent to | Moving house mustn't redraw old routes |
| 2026-10-14 (first version) | Trip rule: a sender's cards posted within 10 days of each other are revealed together, when the last arrives | Otherwise the first card to arrive spoils the rest of the trip |
| 2026-10-14 (first version) | Matching an arrived card needs both sender and country | Picking only a name could reveal the wrong card |
| 2026-10-14 (first version) | Only the recipient photographs a card | They're the one holding it |
| 2026-10-14 (first version) | Migrations only add, and are safe to run twice | The live database holds real data and migrations are run by hand |
