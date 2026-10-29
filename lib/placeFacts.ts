import airports from "@/lib/data/airports.json";
import tourism from "@/lib/data/tourism.json";
import { haversineKm } from "@/lib/geo";

// Server-side lookups for the nicheness score. Every one returns null when the
// number can't be found — the score then leaves that factor out.

const AIRPORTS = airports as [number, number][];
const TOURISM = tourism as Record<string, { arrivals: number; perResident: number; year: number }>;

/** Km to the nearest airport with scheduled flights. */
export function nearestAirportKm(lat: number, lng: number): number | null {
  let best = Infinity;
  for (const [aLat, aLng] of AIRPORTS) {
    if (Math.abs(aLat - lat) > 6) continue; // quick reject: ~660 km of latitude
    const km = haversineKm(lat, lng, aLat, aLng);
    if (km < best) best = km;
  }
  if (best === Infinity) {
    // Very remote: nothing within 6° of latitude, check them all.
    for (const [aLat, aLng] of AIRPORTS) best = Math.min(best, haversineKm(lat, lng, aLat, aLng));
  }
  return Number.isFinite(best) ? best : null;
}

/** International tourist arrivals per year for a country (ISO alpha-2). */
export function touristArrivals(countryCode: string): { arrivals: number; year: number } | null {
  const t = TOURISM[countryCode.toUpperCase()];
  return t ? { arrivals: t.arrivals, year: t.year } : null;
}
