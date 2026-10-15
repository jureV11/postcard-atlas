/**
 * Nicheness settings — the one place to tune how scores are worked out.
 *
 * Each factor turns a real-world number into 0–1 on a log scale between
 * `full` (counts fully as niche) and `zero` (counts as not niche at all).
 * The 0–1 values are then weighted. A factor whose number can't be found is
 * left out and the remaining weights are scaled up to still total 100.
 */
export const NICHE = {
  /** Points out of 100. Location factors weigh more than the country one. */
  weights: {
    population: 30,
    remoteness: 25,
    tourism: 20,
    obscurity: 25,
  },

  /** Town population (GeoNames). Anything this small or smaller scores full, so tiny villages don't get extra. */
  population: { full: 5_000, zero: 5_000_000 },

  /** Km to the nearest airport with scheduled flights (OurAirports). Linear, not log. */
  remoteness: { zero: 0, full: 150 },

  /** Tourist arrivals per resident, for the whole country (World Bank, latest year up to 2019). */
  tourism: { full: 0.02, zero: 5 },

  /** Monthly views of the town's English Wikipedia article, averaged over the last 12 months. */
  obscurity: { full: 300, zero: 300_000 },

  /** How long a city's looked-up numbers are cached on the server. */
  cacheSeconds: 60 * 60 * 24 * 30,
} as const;

export type NicheFactor = keyof typeof NICHE.weights;
