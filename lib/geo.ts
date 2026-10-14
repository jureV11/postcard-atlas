export type City = {
  id?: number;
  name: string;
  admin1?: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2, uppercase
  lat: number;
  lng: number;
};

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("en")} km`;
}

type OpenMeteoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

/** City search via Open-Meteo's free geocoding API (no key, CORS-enabled). */
export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  // The API matches on a single name; "Paris, France" would return nothing.
  const name = query.split(",")[0].trim();
  if (name.length < 2) return [];

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("City search failed");
  const json = (await res.json()) as { results?: OpenMeteoResult[] };

  return (json.results ?? [])
    .filter((r) => r.country_code)
    .map((r) => ({
      id: r.id,
      name: r.name,
      admin1: r.admin1,
      country: r.country ?? r.country_code!,
      countryCode: r.country_code!.toUpperCase(),
      lat: r.latitude,
      lng: r.longitude,
    }));
}
