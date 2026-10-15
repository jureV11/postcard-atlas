import { unstable_cache } from "next/cache";
import airports from "@/lib/data/airports.json";
import tourism from "@/lib/data/tourism.json";
import { haversineKm } from "@/lib/geo";
import { NICHE } from "@/lib/niche.config";

// Server-side lookups for the nicheness score. Every one returns null when the
// number can't be found — the score then leaves that factor out.

const AIRPORTS = airports as [number, number][];
const TOURISM = tourism as Record<string, { perResident: number; year: number }>;
// Wikimedia asks API users to identify themselves with a way to get in touch.
const UA = "PostcardAtlas/1.0 (https://github.com/jureV11/postcard-atlas; private postcard log for friends)";

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

/** Tourist arrivals per resident for a country (ISO alpha-2). */
export function touristsPerResident(countryCode: string): { perResident: number; year: number } | null {
  return TOURISM[countryCode.toUpperCase()] ?? null;
}

type WikiPage = { title: string; coordinates?: { lat: number; lon: number }[]; pageprops?: { disambiguation?: string } };

async function wikiQuery(params: Record<string, string>): Promise<WikiPage[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", format: "json", formatversion: "2", ...params }))
    url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`Wikipedia: HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: (WikiPage & { missing?: boolean })[] } };
  return (json.query?.pages ?? []).filter((p) => !p.missing);
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** The English Wikipedia article for a town, matched by name and checked against the card's coordinates. */
async function findArticle(city: string, country: string, lat: number, lng: number): Promise<string | null> {
  const near = (p: WikiPage, km: number) =>
    !p.pageprops?.disambiguation && !!p.coordinates?.[0] && haversineKm(lat, lng, p.coordinates[0].lat, p.coordinates[0].lon) < km;

  // 1. "Kyoto", then "Kyoto, Japan" — following redirects.
  for (const title of [city, `${city}, ${country}`]) {
    const [page] = await wikiQuery({ titles: title, redirects: "1", prop: "coordinates|pageprops" });
    if (page && near(page, 30)) return page.title;
  }
  // 2. Articles near the coordinates whose title starts with the town's name.
  const pages = await wikiQuery({
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: "10000",
    ggslimit: "50",
    prop: "coordinates|pageprops",
  });
  const name = fold(city);
  const match = pages.find((p) => fold(p.title).split(",")[0] === name) ?? pages.find((p) => fold(p.title).startsWith(name));
  return match && near(match, 30) ? match.title : null;
}

// Throws on a failed request, so only real answers (including "no article") get cached.
const views = unstable_cache(
  async (city: string, country: string, lat: number, lng: number): Promise<{ title: string; monthly: number } | null> => {
    const title = await findArticle(city, country, lat, lng);
    if (!title) return null;
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // start of this month
    const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
    const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");
    const url =
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/" +
      `${encodeURIComponent(title.replaceAll(" ", "_"))}/monthly/${ymd(start)}/${ymd(new Date(end.getTime() - 86_400_000))}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, cache: "no-store" });
    if (res.status === 404) return null; // article too new or never viewed
    if (!res.ok) throw new Error(`Wikimedia pageviews: HTTP ${res.status}`);
    const json = (await res.json()) as { items?: { views: number }[] };
    const months = (json.items ?? []).slice(-12);
    if (!months.length) return null;
    return { title, monthly: months.reduce((t, m) => t + m.views, 0) / months.length };
  },
  ["wikipedia-views-v1"],
  { revalidate: NICHE.cacheSeconds },
);

/** Average monthly views of the town's English Wikipedia article over the last 12 full months. */
export async function wikipediaViews(
  city: string,
  country: string,
  lat: number,
  lng: number,
): Promise<{ title: string; monthly: number } | null> {
  try {
    return await views(city, country, Number(lat.toFixed(4)), Number(lng.toFixed(4)));
  } catch {
    return null; // failed this time — tried again on the next visit
  }
}
