import { cityKey } from "@/lib/atlas";
import { haversineKm } from "@/lib/geo";
import { cityPopulation } from "@/lib/population";
import { isLocated, type LocatedPostcard, type Member, type Postcard } from "@/lib/types";

/**
 * Nicheness: how off-the-beaten-path a postcard's origin is, out of 100.
 *
 *   Small place      up to 40  — a village beats a capital (by population)
 *   Rare country     up to 30  — the group's only card from that country scores full
 *   Far from home    up to 30  — distance to the nearest member's home city
 */
export type NicheScore = {
  card: LocatedPostcard;
  score: number;
  population: number | null;
  countryCards: number; // arrived cards from this country, group-wide
  nearestHomeKm: number;
  parts: { place: number; rarity: number; remote: number };
};

const MAX_PLACE = 40;
const MAX_RARITY = 30;
const MAX_REMOTE = 30;
const REMOTE_FULL_KM = 8000;

/** Unknown population counts as middling rather than penalising the card. */
function placePoints(population: number | null): number {
  if (population === null) return MAX_PLACE / 2;
  // ~100 people → 40, ~10k → 24, ~1M → 8, ≥10M → 0
  const t = (7 - Math.log10(Math.max(population, 1))) / 5;
  return MAX_PLACE * Math.min(1, Math.max(0, t));
}

export async function nicheScores(cards: Postcard[], members: Member[]): Promise<NicheScore[]> {
  const arrived = cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

  const perCountry = new Map<string, number>();
  for (const c of arrived) perCountry.set(c.from_country_code, (perCountry.get(c.from_country_code) ?? 0) + 1);

  // One population lookup per distinct city, in parallel.
  const cities = new Map<string, LocatedPostcard>();
  for (const c of arrived) if (!cities.has(cityKey(c))) cities.set(cityKey(c), c);
  const pops = new Map(
    await Promise.all(
      [...cities.entries()].map(async ([key, c]) => [key, await cityPopulation(c.from_city, c.from_lat, c.from_lng)] as const),
    ),
  );

  return arrived.map((card) => {
    const population = pops.get(cityKey(card)) ?? null;
    const countryCards = perCountry.get(card.from_country_code) ?? 1;
    const nearestHomeKm = Math.min(
      ...members.map((m) => haversineKm(card.from_lat, card.from_lng, m.home_lat, m.home_lng)),
    );
    const parts = {
      place: placePoints(population),
      rarity: MAX_RARITY / countryCards,
      remote: MAX_REMOTE * Math.min(1, nearestHomeKm / REMOTE_FULL_KM),
    };
    return {
      card,
      score: Math.round(parts.place + parts.rarity + parts.remote),
      population,
      countryCards,
      nearestHomeKm,
      parts,
    };
  });
}

/** Each member's single most niche postcard, best first. */
export function nicheLeaders<T extends Member>(members: T[], scores: NicheScore[]) {
  return members
    .map((m) => {
      const mine = scores.filter((s) => s.card.sender_id === m.id).sort((a, b) => b.score - a.score);
      return { member: m, best: mine[0] ?? null, average: mine.length ? mine.reduce((t, s) => t + s.score, 0) / mine.length : 0 };
    })
    .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || b.average - a.average);
}
