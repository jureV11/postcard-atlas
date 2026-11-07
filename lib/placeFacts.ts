import tourism from "@/lib/data/tourism.json";

// Server-side lookups for the nicheness score. Every one returns null when the
// number can't be found — the score then leaves that factor out.

const TOURISM = tourism as Record<string, { arrivals: number; perResident: number; year: number }>;

/** International tourist arrivals per year for a country (ISO alpha-2). */
export function touristArrivals(countryCode: string): { arrivals: number; year: number } | null {
  const t = TOURISM[countryCode.toUpperCase()];
  return t ? { arrivals: t.arrivals, year: t.year } : null;
}
