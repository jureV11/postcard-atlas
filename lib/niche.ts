import { cityKey } from "@/lib/atlas";
import { haversineKm } from "@/lib/geo";
import { NICHE, type NicheFactor } from "@/lib/niche.config";
import { nearestAirportKm, touristArrivals } from "@/lib/placeFacts";
import { cityPopulation } from "@/lib/population";
import { isLocated, type LocatedPostcard, type Member, type Postcard } from "@/lib/types";

/**
 * Nicheness: how off-the-beaten-path the town a postcard came from is, out of 100.
 * Four factors (weights in lib/niche.config.ts): far from the group, a country
 * few tourists visit, a small place, far from an airport. Missing data is never
 * guessed: that factor is dropped and the rest reweighted. It depends only on
 * the place, so sending several cards from one country costs nothing.
 */
export type NicheFacts = {
  /** Km to the nearest friend's home, and whose it is. */
  homeKm: number | null;
  nearestFriend: string | null;
  touristArrivals: number | null;
  tourismYear: number | null;
  population: number | null;
  airportKm: number | null;
};

export type NicheFactorResult = {
  factor: NicheFactor;
  /** 0–1, how niche this factor says the place is (null = no data). */
  value: number | null;
  /** Points earned after reweighting (0 when there's no data). */
  points: number;
  /** Out of how many points, after reweighting. */
  max: number;
};

export type NicheScore = {
  card: LocatedPostcard;
  /** Out of 100; null when no factor had data. */
  score: number | null;
  facts: NicheFacts;
  factors: NicheFactorResult[];
};

const LOOKUPS_AT_ONCE = 3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const linear = (v: number, zero: number, full: number) => clamp01((v - zero) / (full - zero));

/** 1 at `full` or beyond, 0 at `zero` or beyond, log scale in between (smaller = more niche). */
function logScale(v: number, full: number, zero: number): number {
  const lv = Math.log(Math.max(v, 1e-9));
  return clamp01((Math.log(zero) - lv) / (Math.log(zero) - Math.log(full)));
}

export function scoreFacts(facts: NicheFacts): Pick<NicheScore, "score" | "factors"> {
  const values: Record<NicheFactor, number | null> = {
    distance: facts.homeKm === null ? null : linear(facts.homeKm, NICHE.distance.zero, NICHE.distance.full),
    tourism: facts.touristArrivals === null ? null : logScale(facts.touristArrivals, NICHE.tourism.full, NICHE.tourism.zero),
    population: facts.population === null ? null : logScale(facts.population, NICHE.population.full, NICHE.population.zero),
    remoteness: facts.airportKm === null ? null : linear(facts.airportKm, NICHE.remoteness.zero, NICHE.remoteness.full),
  };

  const order = Object.keys(NICHE.weights) as NicheFactor[];
  const available = order.filter((f) => values[f] !== null).reduce((t, f) => t + NICHE.weights[f], 0);
  const factors = order.map((factor) => {
    const value = values[factor];
    const max = value === null || !available ? 0 : (NICHE.weights[factor] * 100) / available;
    return { factor, value, max, points: value === null ? 0 : value * max };
  });
  return {
    score: available ? Math.round(factors.reduce((t, f) => t + f.points, 0)) : null,
    factors,
  };
}

async function placeFacts(c: LocatedPostcard, homes: Member[]): Promise<NicheFacts> {
  let homeKm: number | null = null;
  let nearestFriend: string | null = null;
  for (const m of homes) {
    const km = haversineKm(c.from_lat, c.from_lng, m.home_lat, m.home_lng);
    if (homeKm === null || km < homeKm) {
      homeKm = km;
      nearestFriend = m.display_name;
    }
  }
  const tourism = touristArrivals(c.from_country_code);
  return {
    homeKm,
    nearestFriend,
    touristArrivals: tourism?.arrivals ?? null,
    tourismYear: tourism?.year ?? null,
    population: await cityPopulation(c.from_city, c.from_lat, c.from_lng),
    airportKm: nearestAirportKm(c.from_lat, c.from_lng),
  };
}

/** Scores for delivered, public cards. `members` gives the friends' homes (current members only count). */
export async function nicheScores(cards: Postcard[], members: Member[]): Promise<NicheScore[]> {
  const arrived = cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);
  const homes = members.filter((m) => !m.left_at);

  // One set of lookups per distinct town (population is cached on the server),
  // a few towns at a time so the free API doesn't rate-limit us.
  const towns = new Map<string, LocatedPostcard>();
  for (const c of arrived) if (!towns.has(cityKey(c))) towns.set(cityKey(c), c);
  const facts = new Map<string, NicheFacts>();
  const queue = [...towns.entries()];
  for (let i = 0; i < queue.length; i += LOOKUPS_AT_ONCE) {
    const batch = queue.slice(i, i + LOOKUPS_AT_ONCE);
    for (const [key, f] of await Promise.all(batch.map(async ([key, c]) => [key, await placeFacts(c, homes)] as const)))
      facts.set(key, f);
  }

  return arrived.map((card) => {
    const f = facts.get(cityKey(card))!;
    return { card, facts: f, ...scoreFacts(f) };
  });
}

/** Each member's single most niche postcard, best first. */
export function nicheLeaders<T extends Member>(members: T[], scores: NicheScore[]) {
  return members
    .map((m) => {
      const mine = scores
        .filter((s) => s.card.sender_id === m.id && s.score !== null)
        .sort((a, b) => b.score! - a.score!);
      return {
        member: m,
        best: mine[0] ?? null,
        average: mine.length ? mine.reduce((t, s) => t + s.score!, 0) / mine.length : 0,
      };
    })
    .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || b.average - a.average);
}
