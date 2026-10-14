import { haversineKm } from "@/lib/geo";

type GeoResult = { latitude: number; longitude: number; population?: number };

/**
 * Population of the place a postcard came from, looked up (server-side, cached
 * for a week) from Open-Meteo's geocoder — the same source as the city search.
 * Returns null if the place can't be matched or has no population on record.
 */
export async function cityPopulation(name: string, lat: number, lng: number): Promise<number | null> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "10");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: GeoResult[] };

    // Same name can exist in many countries — take the one at the card's coordinates.
    let best: GeoResult | null = null;
    let bestKm = Infinity;
    for (const r of json.results ?? []) {
      const km = haversineKm(lat, lng, r.latitude, r.longitude);
      if (km < bestKm) {
        best = r;
        bestKm = km;
      }
    }
    return best && bestKm < 25 && best.population ? best.population : null;
  } catch {
    return null;
  }
}
