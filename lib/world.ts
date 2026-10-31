import { geoArea, geoCentroid } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

/** `colorIndex` (0–5) is chosen so neighbouring countries never share a colour. */
export type Country = Feature<Geometry, { name: string; colorIndex: number }>;
type Resolution = "110m" | "50m";
type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

export const PALETTE_SIZE = 6;
const cache = new Map<Resolution, Promise<Country[]>>();
let globeCache: Promise<Country[]> | undefined;

/**
 * Country shapes from Natural Earth, loaded once and shared.
 * 50m (~740 KB) includes every small island nation and microstate — used by the
 * flat map. 110m (~105 KB) is much lighter, but too rough up close.
 */
export function loadWorld(resolution: Resolution = "110m"): Promise<Country[]> {
  let p = cache.get(resolution);
  if (!p) {
    const mod =
      resolution === "50m"
        ? import("world-atlas/countries-50m.json")
        : import("world-atlas/countries-110m.json");
    p = mod.then((m) => toCountries(m.default as unknown as CountriesTopology));
    cache.set(resolution, p);
  }
  return p;
}

/**
 * For the globe: the 50m map, simplified away from Europe. All of it in 3D froze
 * the page for ~12 s; with the long far-off coasts (Russia, Canada…) roughened
 * it builds in well under a second. Europe and small places keep every point.
 * Each border is one shared line in the file, simplified once, so neighbours
 * always still meet exactly.
 */
export function loadGlobeWorld(): Promise<Country[]> {
  globeCache ??= import("world-atlas/countries-50m.json").then((m) =>
    toCountries(simplifyTopology(m.default as unknown as CountriesTopology, GLOBE_TOLERANCE)).map(withoutIslets),
  );
  return globeCache;
}

/**
 * Every island is drawn on its own, every frame, so the hundreds of islets off
 * Canada, Indonesia… made spinning heavy. Outside Europe, islands under 500 km²
 * go (a country always keeps its biggest piece: Malta, Monaco stay).
 */
function withoutIslets(f: Country): Country {
  if (f.geometry.type !== "MultiPolygon") return f;
  const pieces = f.geometry.coordinates.map((coordinates) => ({ coordinates, area: geoArea({ type: "Polygon", coordinates }) }));
  const biggest = Math.max(...pieces.map((p) => p.area));
  const kept = pieces.filter(({ coordinates, area }) => {
    if (area === biggest || area >= 500 / 6371 ** 2) return true;
    const [lng, lat] = geoCentroid({ type: "Polygon", coordinates });
    return lng > -25 && lng < 45 && lat > 34 && lat < 72;
  });
  return { ...f, geometry: { type: "MultiPolygon", coordinates: kept.map((p) => p.coordinates) } };
}

/** How far (in degrees) a simplified line may stray from the real one, away from Europe. */
const GLOBE_TOLERANCE = 0.1;

function toCountries(topo: CountriesTopology): Country[] {
  const geometries = topo.objects.countries.geometries;
  const colors = colorMap(neighbors(geometries as Parameters<typeof neighbors>[0]));
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  return fc.features
    .map((f, i) => ({ ...f, properties: { ...f.properties, colorIndex: colors[i] } }) as Country)
    .filter((f) => f.id !== "010"); // Antarctica just wastes space
}

/**
 * Simplifies every border line (arc) of the topology, keeping both ends so
 * shared borders stay shared. Lines in Europe are left as they are, and so is
 * any island too small to keep its shape (fewer than 4 points left).
 */
export function simplifyTopology(topo: CountriesTopology, tolerance: number): CountriesTopology {
  const [kx, ky] = topo.transform?.scale ?? [1, 1];
  const [dx, dy] = topo.transform?.translate ?? [0, 0];
  // Russia crosses the date line, so the globe builds it the slow way: its
  // coasts get simplified even in Europe (its borders with neighbours don't).
  const russianCoast = arcsOnlyUsedBy(topo, "643");
  const arcs = topo.arcs.map((arc, index) => {
    // Arcs are stored as whole-number steps from the previous point.
    let x = 0;
    let y = 0;
    const points = arc.map(([a, b]) => [(x += a) * kx + dx, (y += b) * ky + dy]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const [w, e, s, n] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const [cx, cy] = [(w + e) / 2, (s + n) / 2];
    if (cx > -25 && cx < 45 && cy > 34 && cy < 72 && !russianCoast.has(index)) return points;
    const simpler = simplifyLine(points, russianCoast.has(index) ? tolerance * 5 : tolerance);
    return simpler.length < 4 && points.length >= 4 ? points : simpler;
  });
  return { ...topo, transform: undefined, arcs };
}

/** Arcs (by index) that belong to this country alone: its coasts, not its borders. */
function arcsOnlyUsedBy(topo: CountriesTopology, id: string): Set<number> {
  const uses = new Map<number, Set<string>>();
  const walk = (arcs: unknown, owner: string) => {
    if (typeof arcs === "number") {
      const i = arcs < 0 ? ~arcs : arcs;
      uses.set(i, (uses.get(i) ?? new Set()).add(owner));
    } else if (Array.isArray(arcs)) arcs.forEach((a) => walk(a, owner));
  };
  topo.objects.countries.geometries.forEach((g, n) => walk("arcs" in g ? g.arcs : [], String(g.id ?? `#${n}`)));
  return new Set([...uses].filter(([, owners]) => owners.size === 1 && owners.has(id)).map(([i]) => i));
}

/** Douglas–Peucker on longitude/latitude (close enough at these sizes). */
function simplifyLine(points: number[][], tolerance: number): number[][] {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay);
    let far = -1;
    let farthest = tolerance;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const d = length ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length : Math.hypot(px - ax, py - ay);
      if (d > farthest) [far, farthest] = [i, d];
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([first, far], [far, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
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
