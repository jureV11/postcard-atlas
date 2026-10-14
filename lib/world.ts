import { feature, neighbors } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

/** `colorIndex` (0–5) is chosen so neighbouring countries never share a colour. */
export type Country = Feature<Geometry, { name: string; colorIndex: number }>;
type Resolution = "110m" | "50m";

export const PALETTE_SIZE = 6;
const cache = new Map<Resolution, Promise<Country[]>>();

/**
 * Country shapes from Natural Earth, loaded once and shared.
 * 50m (~740 KB) includes every small island nation and microstate — used by the
 * flat map. 110m (~105 KB) is enough for the globe and much lighter to render in 3D.
 */
export function loadWorld(resolution: Resolution = "110m"): Promise<Country[]> {
  let p = cache.get(resolution);
  if (!p) {
    const mod =
      resolution === "50m"
        ? import("world-atlas/countries-50m.json")
        : import("world-atlas/countries-110m.json");
    p = mod.then((m) => {
      const topo = m.default as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
      const geometries = topo.objects.countries.geometries;
      const colors = colorMap(neighbors(geometries as Parameters<typeof neighbors>[0]));
      const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
      return fc.features
        .map((f, i) => ({ ...f, properties: { ...f.properties, colorIndex: colors[i] } }) as Country)
        .filter((f) => f.id !== "010"); // Antarctica just wastes space
    });
    cache.set(resolution, p);
  }
  return p;
}

/** Greedy map colouring: most-connected countries first, lowest free colour. */
function colorMap(adjacency: number[][]): number[] {
  const colors = new Array<number>(adjacency.length).fill(-1);
  const order = adjacency.map((_, i) => i).sort((a, b) => adjacency[b].length - adjacency[a].length);
  for (const i of order) {
    const used = new Set(adjacency[i].map((j) => colors[j]));
    let c = 0;
    while (used.has(c) && c < PALETTE_SIZE - 1) c++;
    // Spread isolated islands across the palette instead of piling them on colour 0
    colors[i] = adjacency[i].length === 0 ? i % PALETTE_SIZE : c;
  }
  return colors;
}
