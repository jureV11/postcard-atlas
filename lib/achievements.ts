import { CONTINENTS, continentOf, continentProgress } from "@/lib/continents";
import type { MemberStats } from "@/lib/stats";
import { cardKm } from "@/lib/stats";
import { destinationOf, isLocated, type Member, type Postcard } from "@/lib/types";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** Progress towards it, e.g. 3 of 5 (omitted for yes/no ones). */
  progress?: { have: number; need: number };
  /** Secret until earned. */
  secret?: boolean;
};

const DAY_MS = 86_400_000;

/** Countries that are islands (or made of islands), by ISO code. */
const ISLAND_NATIONS = new Set(
  ("ag bb bh bs cu cv cy dm do fj fm gb gd ht id ie is jm jp ki km kn lc lk mg mh mt mu mv nr nz " +
    "ph pw sb sc sg st to tt tv tw vc vu ws").split(" "),
);

/** Northern-hemisphere season of a date: 0 winter, 1 spring, 2 summer, 3 autumn. */
const seasonOf = (date: string) => Math.floor((Number(date.slice(5, 7)) % 12) / 3);

/** Posted between 20 December and 6 January. */
function festive(date: string): boolean {
  const md = date.slice(5, 10);
  return md >= "12-20" || md <= "01-06";
}

/**
 * A member's achievements, from cards that count everywhere else: sent cards
 * that arrived and are public, and public cards they received. Lost cards are
 * only used for the one (secret) badge about them. Hand-delivered cards never
 * went through the post, so they don't count for delivery-time badges.
 */
export function achievementsFor(
  member: Member,
  stats: MemberStats,
  cards: Postcard[],
  membersById: Map<string, Member>,
): Achievement[] {
  const sent = stats.arrived; // delivered + public
  const countries = stats.countries.map((c) => c.code);
  const continents = new Set(countries.map(continentOf).filter(Boolean));
  const bestContinent = continentProgress(countries)
    .map((c) => ({ ...c, share: c.visited / c.total }))
    .sort((a, b) => b.share - a.share)[0];

  const days = sent
    .filter((c) => c.received_on && !c.hand_delivered)
    .map((c) => Math.max(1, Math.round((Date.parse(c.received_on!) - Date.parse(c.sent_on)) / DAY_MS)));
  const longest = sent.reduce((m, c) => Math.max(m, cardKm(c, membersById.get(c.recipient_id))), 0);

  const perFriend = new Map<string, number>();
  for (const c of sent) perFriend.set(c.recipient_id, (perFriend.get(c.recipient_id) ?? 0) + 1);
  const mostToOne = Math.max(0, ...perFriend.values());

  const receivedCards = cards
    .filter((c) => c.recipient_id === member.id && c.status === "received" && c.is_public)
    .filter(isLocated);
  const receivedPublic = receivedCards.length;
  const receivedCountries = new Set(receivedCards.map((c) => c.from_country_code));
  const receivedContinents = new Set([...receivedCountries].map(continentOf).filter(Boolean));
  const receivedFrom = new Set(receivedCards.map((c) => c.sender_id));
  const lostOne = cards.some((c) => c.sender_id === member.id && c.status === "lost");
  const handDelivered = sent.some((c) => c.hand_delivered);
  const nearest = sent.reduce((m, c) => Math.min(m, cardKm(c, membersById.get(c.recipient_id))), Infinity);

  // Biggest trip: cards posted within 10 days of each other (the same rule as the reveal).
  const sentDays = sent.map((c) => Date.parse(c.sent_on)).sort((a, b) => a - b);
  let biggestTrip = 0;
  for (let i = 0, run = 0; i < sentDays.length; i++) {
    run = i > 0 && sentDays[i] - sentDays[i - 1] <= 10 * DAY_MS ? run + 1 : 1;
    biggestTrip = Math.max(biggestTrip, run);
  }

  // Sent to someone who sent one back (or the other way round).
  const sentTo = new Set(sent.map((c) => c.recipient_id));
  const swaps = [...receivedFrom].filter((id) => sentTo.has(id)).length;
  const islands = new Set(countries.filter((c) => ISLAND_NATIONS.has(c.toLowerCase())));
  const crossedEquator = sent.some((c) => {
    const to = destinationOf(c, membersById.get(c.recipient_id));
    return !!to && Math.sign(c.from_lat) !== Math.sign(to.lat);
  });
  const seasons = new Set(sent.map((c) => seasonOf(c.sent_on)));
  const friends = [...membersById.values()].filter((m) => m.id !== member.id && !m.left_at && m.group_id === member.group_id);
  const friendsReached = friends.filter((m) => sentTo.has(m.id)).length;
  const festiveCard = sent.some((c) => festive(c.sent_on));

  const count = (id: string, name: string, description: string, have: number, need: number): Achievement => ({
    id,
    name,
    description,
    earned: have >= need,
    progress: { have: Math.min(have, need), need },
  });

  return [
    count("first", "First stamp", "Send your first postcard that arrives", sent.length, 1),
    count("countries-5", "Globetrotter", "Postcards from 5 countries", countries.length, 5),
    count("countries-15", "Jet-setter", "Postcards from 15 countries", countries.length, 15),
    count("continents-3", "Continental", "Postcards from 3 continents", continents.size, 3),
    {
      id: "continent-half",
      name: "Half a continent",
      description: bestContinent?.visited
        ? `Half the countries of one continent — best so far: ${bestContinent.name} ${bestContinent.visited}/${bestContinent.total}`
        : "Postcards from half the countries of one continent",
      earned: !!bestContinent && bestContinent.share >= 0.5,
      progress: bestContinent
        ? { have: Math.min(bestContinent.visited, Math.ceil(bestContinent.total / 2)), need: Math.ceil(bestContinent.total / 2) }
        : undefined,
    },
    count("long-haul", "Long haul", "A postcard that travelled 10,000 km", Math.round(longest), 10_000),
    count("slow-boat", "Slow boat", "A postcard that took 60 days or more", Math.max(0, ...days), 60),
    {
      id: "express",
      name: "Express",
      description: "A postcard that arrived within 3 days",
      earned: days.some((d) => d <= 3),
    },
    count("pen-pal", "Pen pal", "5 postcards to the same friend", mostToOne, 5),
    count("mailbox", "Full mailbox", "Receive 10 postcards", receivedPublic, 10),
    // Receiving
    count("world-mail", "World mail", "Receive postcards from 3 continents", receivedContinents.size, 3),
    count(
      "every-continent",
      "Every corner",
      `Receive postcards from all ${CONTINENTS.length} inhabited continents`,
      receivedContinents.size,
      CONTINENTS.length,
    ),
    count("collector", "Collector", "Receive postcards from 10 countries", receivedCountries.size, 10),
    count("fan-club", "Fan club", "Receive postcards from 3 different friends", receivedFrom.size, 3),
    // Sending
    count("postie", "Postie", "Send 25 postcards that arrive", sent.length, 25),
    count("around-the-world", "Around the world", "Your postcards travel 40,075 km in total", Math.round(stats.postcardKm), 40_075),
    {
      id: "neighbourly",
      name: "Neighbourly",
      description: "A postcard from less than 100 km away",
      earned: nearest < 100,
    },
    count("trip", "Trip report", "3 postcards from the same trip", biggestTrip, 3),
    count("island-hopper", "Island hopper", "Postcards from 3 island countries", islands.size, 3),
    {
      id: "equator",
      name: "Line crosser",
      description: "A postcard that crossed the equator",
      earned: crossedEquator,
    },
    count("antipodes", "Other side of the world", "A postcard that travelled 15,000 km", Math.round(longest), 15_000),
    count("four-seasons", "Four seasons", "Send postcards in winter, spring, summer and autumn", seasons.size, 4),
    count("swap", "Swap meet", "Swap postcards with 3 friends: they send you one, you send them one", swaps, 3),
    count(
      "round-robin",
      "Round robin",
      "Send a postcard to every friend in the group",
      friendsReached,
      Math.max(2, friends.length),
    ),
    {
      id: "festive",
      name: "Season's greetings",
      description: festiveCard ? "Posted a postcard over Christmas and New Year" : "A secret one…",
      earned: festiveCard,
      secret: true,
    },
    {
      id: "special-delivery",
      name: "Special delivery",
      description: handDelivered ? "Hand-delivered a postcard" : "A secret one…",
      earned: handDelivered,
      secret: true,
    },
    {
      id: "lost",
      name: "Lost at sea",
      description: lostOne ? "Had a postcard go missing in the post" : "A secret one…",
      earned: lostOne,
      secret: true,
    },
  ];
}
