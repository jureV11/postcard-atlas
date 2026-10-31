import { geoArea, geoBounds, geoDistance, geoInterpolate } from "d3-geo";
import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { Country } from "./world";

const FLAT = 180; // a resolution the globe never subdivides at: its flat fill
const CURVED = 1.5; // the surface follows the globe's curve every 1.5°
const resolutions = new WeakMap<object, number>();
const tiny = new WeakMap<object, boolean>();

/** Under ~400 km² (Vatican, San Marino…): some sit inside a bigger country's shape. */
export function isTiny(d: object): boolean {
  let t = tiny.get(d);
  if (t === undefined) {
    t = geoArea(d as Country) < 1e-5;
    tiny.set(d, t);
  }
  return t;
}

/**
 * For `polygonCapCurvatureResolution`: how finely a country's surface follows the
 * globe's curve. The curved fill doesn't follow ragged coasts (Zeeland's colour
 * stopped short of its border), the flat one does. Up to 3.6° across, a flat
 * surface sags less than the lowest land sits above the sea (0.00055 of the
 * radius, zoomed right in), so those countries are drawn flat.
 */
export function capResolution(d: object): number {
  let res = resolutions.get(d);
  if (res === undefined) {
    res = polygonsOf((d as Country).geometry).every(([ring]) => widthDegrees(ring) <= 3.6) ? FLAT : CURVED;
    resolutions.set(d, res);
  }
  return res;
}

const geometries = new WeakMap<object, MultiPolygon>();

/**
 * For `polygonGeoJsonGeometry`: bigger countries get a border point every 0.5°.
 * The curved fill joins the nearest points into triangles, so with points this
 * close together it follows the border instead of cutting across bays (Wales).
 * Not Russia: it crosses the date line, so the globe builds it the slow way,
 * and every extra point there costs (its long, smooth coasts don't need them).
 */
export function capGeometry(d: object): Polygon | MultiPolygon {
  const f = d as Country;
  if (capResolution(d) !== CURVED || f.id === "643") return f.geometry as Polygon | MultiPolygon;
  let g = geometries.get(d);
  if (!g) {
    g = { type: "MultiPolygon", coordinates: polygonsOf(f.geometry).map((rings) => rings.map(densify)) };
    geometries.set(d, g);
  }
  return g;
}

function densify(ring: Position[]): Position[] {
  const out: Position[] = [];
  ring.forEach((p, i) => {
    const prev = ring[i - 1];
    if (prev) {
      const pieces = Math.ceil((geoDistance(prev as [number, number], p as [number, number]) * 180) / Math.PI / 0.5);
      const at = geoInterpolate(prev as [number, number], p as [number, number]);
      for (let k = 1; k < pieces; k++) out.push(at(k / pieces));
    }
    out.push(p);
  });
  return out;
}

function polygonsOf(g: Geometry): Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
}

/**
 * About how wide a ring is, in degrees: its widest extent over 8 directions on a
 * local flat projection (within 2% of the true width). Big shapes skip the work.
 */
function widthDegrees(ring: Position[]): number {
  const [[w, s], [e, n]] = geoBounds({ type: "Polygon", coordinates: [ring] });
  if (geoDistance([w, s], [e, n]) > (6 * Math.PI) / 180) return Infinity;
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  let max = 0;
  for (let i = 0; i < 8; i++) {
    const [dx, dy] = [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)];
    let lo = Infinity;
    let hi = -Infinity;
    for (const [lng, lat] of ring) {
      const p = lng * k * dx + lat * dy;
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
    max = Math.max(max, hi - lo);
  }
  return max;
}
