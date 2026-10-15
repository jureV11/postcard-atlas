import { unstable_cache } from "next/cache";
import { haversineKm } from "@/lib/geo";
import { NICHE } from "@/lib/niche.config";

type GeoResult = { latitude: number; longitude: number; population?: number };

// Throws on a failed request, so only real answers get cached.
const lookup = unstable_cache(
  async (name: string, lat: number, lng: number): Promise<number | null> => {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "10");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
    const json = (await res.json()) as { results?: GeoResult[] };

    // Same name can exist in many countries — take the one at the card's coordinates.
    // Only places with a population count (a nearer "Reykjavik Airport" has none).
    let best: GeoResult | null = null;
    let bestKm = Infinity;
    for (const r of json.results ?? []) {
      if (!r.population) continue;
      const km = haversineKm(lat, lng, r.latitude, r.longitude);
      if (km < bestKm) {
        best = r;
        bestKm = km;
      }
    }
    return best && bestKm < 25 ? best.population! : null;
  },
  ["city-population-v2"],
  { revalidate: NICHE.cacheSeconds },
);

/**
 * Population of the place a postcard came from (GeoNames data, via Open-Meteo's
 * geocoder — the same source as the city search), cached per city on the server.
 * Returns null if the place can't be matched, has no population on record, or
 * the lookup failed (a failure is retried next time, not cached).
 */
export async function cityPopulation(name: string, lat: number, lng: number): Promise<number | null> {
  try {
    return await lookup(name, Number(lat.toFixed(4)), Number(lng.toFixed(4)));
  } catch {
    return null;
  }
}
