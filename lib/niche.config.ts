/**
 * Nicheness settings — the one place to tune how scores are worked out.
 *
 * Each factor turns a real-world number into 0–1 between `zero` (not niche at
 * all) and `full` (as niche as it gets). The 0–1 values are then weighted. A
 * factor whose number can't be found is left out and the remaining weights are
 * scaled up to still total 100.
 *
 * What makes a card niche: it came from far away, from a country few people
 * ever visit, from a small place, far from the nearest airport.
 */
export const NICHE = {
  /** Points out of 100. */
  weights: {
    distance: 35,
    tourism: 30,
    population: 20,
    remoteness: 15,
  },

  /** Km from the nearest friend's home in the group. Linear: next door = 0, the other side of the world = full. */
  distance: { zero: 100, full: 9_000 },

  /** Tourist arrivals per year for the whole country (World Bank, latest year up to 2019). Log scale. */
  tourism: { full: 100_000, zero: 40_000_000 },

  /** Town population (GeoNames). Anything this small or smaller scores full, so tiny villages don't get extra. Log scale. */
  population: { full: 5_000, zero: 5_000_000 },

  /** Km to the nearest airport with scheduled flights (OurAirports). Linear. */
  remoteness: { zero: 0, full: 150 },

  /** How long a town's looked-up population is cached on the server. */
  cacheSeconds: 60 * 60 * 24 * 30,
} as const;

export type NicheFactor = keyof typeof NICHE.weights;
