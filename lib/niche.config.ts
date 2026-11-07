/**
 * Nicheness settings — the one place to tune how scores are worked out.
 *
 * Each factor turns a real-world number into 0–1 between `zero` (not niche at
 * all) and `full` (as niche as it gets). The 0–1 values are then weighted. A
 * factor whose number can't be found is left out and the remaining weights are
 * scaled up to still total 100.
 *
 * What makes a card niche: it came from a country few people ever visit, far
 * from the group, from a small place, from an island out at sea.
 */
export const NICHE = {
  /** Points out of 100. */
  weights: {
    distance: 25,
    tourism: 35,
    population: 20,
    island: 20,
  },

  /**
   * Km from the nearest friend's home in the group. Log scale, so the first few
   * thousand km count the most: a long-haul flight alone doesn't make a place niche.
   */
  distance: { zero: 150, full: 6_000 },

  /** Tourist arrivals per year for the whole country (World Bank, latest year up to 2019). Log scale. */
  tourism: { full: 100_000, zero: 40_000_000 },

  /** Town population (GeoNames). Anything this small or smaller scores full, so tiny villages don't get extra. Log scale. */
  population: { full: 5_000, zero: 5_000_000 },

  /**
   * Km out to sea: from the town to the nearest mainland, which is any land of at
   * least `mainlandKm2` (Great Britain, Java and Honshu count). Log scale: an island
   * just off the coast scores nothing, Malta (~280 km) most of it, Hawaii full.
   */
  island: { zero: 25, full: 600, mainlandKm2: 120_000 },

  /** How long a town's looked-up population is cached on the server. */
  cacheSeconds: 60 * 60 * 24 * 30,
} as const;

export type NicheFactor = keyof typeof NICHE.weights;
