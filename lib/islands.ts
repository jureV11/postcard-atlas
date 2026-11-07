import { geoArea, geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { haversineKm } from "@/lib/geo";
import { NICHE } from "@/lib/niche.config";

// Is a town out on an island, and how far out? Being on one usually means an
// airport nearby, so distance to an airport can't tell. Uses Natural Earth's land
// shapes (world-atlas, 50m): every continent and island on the map as one shape
// each, whatever countries share it.

const EARTH_RADIUS_KM = 6371;
type Landmass = { shape: Feature<Polygon>; km2: number; bounds: [[number, number], [number, number]]; coast: [number, number][] };
type LandTopology = Topology<{ land: GeometryCollection }>;

let landCache: Promise<Landmass[]> | undefined;

function loadLand(): Promise<Landmass[]> {
  landCache ??= import("world-atlas/land-50m.json").then((m) => {
    const topo = m.default as unknown as LandTopology;
    const land = feature(topo, topo.objects.land) as FeatureCollection<Polygon | MultiPolygon>;
    return land.features
      .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
      .map((coordinates) => {
        const shape: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
        return { shape, km2: geoArea(shape) * EARTH_RADIUS_KM ** 2, bounds: geoBounds(shape), coast: coordinates[0] as [number, number][] };
      });
  });
  return landCache;
}

const PAD = 0.5; // degrees around a shape's box, for the nearby points below

function nearBox([[w, s], [e, n]]: Landmass["bounds"], lng: number, lat: number): boolean {
  if (lat < s - PAD || lat > n + PAD) return false;
  // A box across the date line (Fiji, Russia) has its west edge east of its east edge
  return w <= e ? lng >= w - PAD && lng <= e + PAD : lng >= w - PAD || lng <= e + PAD;
}

/** The land a town is on. The map's coastlines are a little rough, so a seaside town just off them gets the nearest. */
function landAt(land: Landmass[], lat: number, lng: number): Landmass | null {
  const near = land.filter((l) => nearBox(l.bounds, lng, lat));
  const at = (pLat: number, pLng: number) => near.find((l) => geoContains(l.shape, [pLng, pLat]));
  const exact = at(lat, lng);
  if (exact) return exact;
  // Rings of points around the town, closest first (~5, ~15, ~30 km)
  const stretch = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180)); // degrees of longitude shrink towards the poles
  for (const r of [0.05, 0.15, 0.3]) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const hit = at(lat + r * Math.sin(a), lng + r * Math.cos(a) * stretch);
      if (hit) return hit;
    }
  }
  return null;
}

export type IslandFacts = {
  /** Km² of the land it's on; 0 for an island too small to be on the map. */
  landKm2: number;
  /** Km to the nearest mainland (0 when it's on one). */
  offshoreKm: number;
};

/**
 * How far out to sea a town is: 0 on a mainland (any land of at least
 * `NICHE.island.mainlandKm2`, so Great Britain, Java and Honshu count, and New
 * York or Copenhagen aren't islands), ~280 km for Malta, ~3,800 km for Hawaii.
 */
export async function islandFacts(lat: number, lng: number): Promise<IslandFacts | null> {
  let land: Landmass[];
  try {
    land = await loadLand();
  } catch {
    return null;
  }
  const here = landAt(land, lat, lng);
  const landKm2 = here?.km2 ?? 0;
  if (landKm2 >= NICHE.island.mainlandKm2) return { landKm2, offshoreKm: 0 };

  let offshoreKm = Infinity;
  for (const l of land) {
    if (l.km2 < NICHE.island.mainlandKm2) continue;
    for (const [cLng, cLat] of l.coast) {
      if (Math.abs(cLat - lat) * 111 > offshoreKm) continue; // a whole degree of latitude is ~111 km
      offshoreKm = Math.min(offshoreKm, haversineKm(lat, lng, cLat, cLng));
    }
  }
  return Number.isFinite(offshoreKm) ? { landKm2, offshoreKm } : null;
}
