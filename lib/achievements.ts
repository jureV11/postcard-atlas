import { continentOf, continentProgress } from "@/lib/continents";
import type { MemberStats } from "@/lib/stats";
import { cardKm } from "@/lib/stats";
import type { Member, Postcard } from "@/lib/types";

export type Achievement = {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
  /** Progress towards it, e.g. 3 of 5 (omitted for yes/no ones). */
  progress?: { have: number; need: number };
  /** Secret until earned. */
  secret?: boolean;
};

const DAY_MS = 86_400_000;

/**
 * A member's achievements, from cards that count everywhere else: sent cards
 * that arrived and are public, and public cards they received. Lost cards are
 * only used for the one (secret) badge about them.
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
    .filter((c) => c.received_on)
    .map((c) => Math.max(1, Math.round((Date.parse(c.received_on!) - Date.parse(c.sent_on)) / DAY_MS)));
  const longest = sent.reduce((m, c) => Math.max(m, cardKm(c, membersById.get(c.recipient_id))), 0);

  const perFriend = new Map<string, number>();
  for (const c of sent) perFriend.set(c.recipient_id, (perFriend.get(c.recipient_id) ?? 0) + 1);
  const mostToOne = Math.max(0, ...perFriend.values());

  const receivedPublic = cards.filter((c) => c.recipient_id === member.id && c.status === "received" && c.is_public).length;
  const lostOne = cards.some((c) => c.sender_id === member.id && c.status === "lost");

  const count = (id: string, icon: string, name: string, description: string, have: number, need: number): Achievement => ({
    id,
    icon,
    name,
    description,
    earned: have >= need,
    progress: { have: Math.min(have, need), need },
  });

  return [
    count("first", "📮", "First stamp", "Send your first postcard that arrives", sent.length, 1),
    count("countries-5", "🌍", "Globetrotter", "Postcards from 5 countries", countries.length, 5),
    count("countries-15", "✈️", "Jet-setter", "Postcards from 15 countries", countries.length, 15),
    count("continents-3", "🧭", "Continental", "Postcards from 3 continents", continents.size, 3),
    {
      id: "continent-half",
      icon: "🗺️",
      name: "Half a continent",
      description: bestContinent?.visited
        ? `Half the countries of one continent — best so far: ${bestContinent.name} ${bestContinent.visited}/${bestContinent.total}`
        : "Postcards from half the countries of one continent",
      earned: !!bestContinent && bestContinent.share >= 0.5,
      progress: bestContinent
        ? { have: Math.min(bestContinent.visited, Math.ceil(bestContinent.total / 2)), need: Math.ceil(bestContinent.total / 2) }
        : undefined,
    },
    count("long-haul", "🛫", "Long haul", "A postcard that travelled 10,000 km", Math.round(longest), 10_000),
    count("slow-boat", "🐢", "Slow boat", "A postcard that took 60 days or more", Math.max(0, ...days), 60),
    {
      id: "express",
      icon: "⚡",
      name: "Express",
      description: "A postcard that arrived within 3 days",
      earned: days.some((d) => d <= 3),
    },
    count("pen-pal", "💌", "Pen pal", "5 postcards to the same friend", mostToOne, 5),
    count("mailbox", "📬", "Full mailbox", "Receive 10 postcards", receivedPublic, 10),
    {
      id: "lost",
      icon: "🌊",
      name: "Lost at sea",
      description: lostOne ? "Had a postcard go missing in the post" : "A secret one…",
      earned: lostOne,
      secret: true,
    },
  ];
}
