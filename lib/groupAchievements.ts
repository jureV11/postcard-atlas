import type { Achievement } from "@/lib/achievements";
import { CONTINENTS, continentOf } from "@/lib/continents";
import { isCapital } from "@/lib/data/capitals";
import { isFormer } from "@/lib/members";
import { MOON_AND_BACK_KM } from "@/lib/passport";
import { cardKm } from "@/lib/stats";
import { isLocated, type Member, type Postcard } from "@/lib/types";

/**
 * Achievements the whole group earns together, for the Group page. Delivered,
 * public cards only (the same ones the leaderboard's passport counts), so a
 * card still on its way never shows up here.
 */
export function groupAchievements(cards: Postcard[], members: Member[]): Achievement[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const delivered = cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

  const km = Math.round(delivered.reduce((sum, c) => sum + cardKm(c, byId.get(c.recipient_id)), 0));
  const countries = [...new Set(delivered.map((c) => c.from_country_code.toUpperCase()))];
  const continents = new Set(countries.map(continentOf).filter(Boolean));
  // Countries only (territories like the Faroe Islands don't make a continent whole).
  const best = CONTINENTS.map((c) => ({ name: c.name, total: c.codes.size, visited: countries.filter((code) => c.codes.has(code)).length }))
    .map((c) => ({ ...c, share: c.visited / c.total }))
    .sort((a, b) => b.share - a.share)[0];
  const current = members.filter((m) => !isFormer(m));
  const senders = new Set(delivered.map((c) => c.sender_id));
  const joinedIn = current.filter((m) => senders.has(m.id)).length;
  // Pairs of current members with a postcard between them, either way.
  const ids = new Set(current.map((m) => m.id));
  const linked = new Set(
    delivered.filter((c) => ids.has(c.sender_id) && ids.has(c.recipient_id)).map((c) => [c.sender_id, c.recipient_id].sort().join("|")),
  );
  const pairs = (current.length * (current.length - 1)) / 2;
  const capitals = new Set(delivered.filter((c) => isCapital(c.from_country_code, c.from_lat, c.from_lng)).map((c) => c.from_country_code));

  const count = (id: string, name: string, description: string, have: number, need: number): Achievement => ({
    id,
    name,
    description,
    earned: have >= need,
    progress: { have: Math.min(have, need), need },
  });
  const half = Math.ceil(best.total / 2);

  return [
    count("group-everyone", "Everyone's in", "Every member has sent a postcard that arrived", joinedIn, Math.max(1, current.length)),
    count("group-pen-pal-web", "Pen pal web", "Every two members have a postcard between them (either way)", linked.size, Math.max(1, pairs)),
    count("group-century", "Century", "100 postcards delivered", delivered.length, 100),
    count("group-100k", "Hundred thousand club", "Postcards travel 100,000 km together", km, 100_000),
    count("group-moon", "To the Moon and back", "Postcards travel 768,800 km together", km, MOON_AND_BACK_KM),
    count("group-million", "Millionaires", "Postcards travel 1,000,000 km together", km, 1_000_000),
    count("group-continents-3", "Three corners", "Postcards from 3 continents", continents.size, 3),
    count("group-every-continent", "Every continent", `Postcards from all ${CONTINENTS.length} inhabited continents`, continents.size, CONTINENTS.length),
    count("group-fifty-flags", "Fifty flags", "Postcards from 50 countries", countries.length, 50),
    count("group-capitals", "Capital city tour", "Postcards from 10 capital cities", capitals.size, 10),
    {
      id: "group-continent-half",
      name: "Half a continent",
      description: best.visited
        ? `Postcards from half the countries of one continent — best so far: ${best.name} ${best.visited}/${best.total}`
        : "Postcards from half the countries of one continent",
      earned: best.visited >= half,
      progress: { have: Math.min(best.visited, half), need: half },
    },
    {
      id: "group-continent-full",
      name: "A whole continent",
      description: best.visited
        ? `Postcards from every country of one continent — best so far: ${best.name} ${best.visited}/${best.total}`
        : "Postcards from every country of one continent",
      earned: best.visited >= best.total,
      progress: { have: best.visited, need: best.total },
    },
  ];
}
