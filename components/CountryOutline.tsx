"use client";

import { useEffect, useMemo, useState } from "react";
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { countryKeyFromAlpha2, countryKeyFromFeature } from "@/lib/countries";
import { loadWorld, type Country } from "@/lib/world";

const W = 320;
const H = 220;
const PAD = 18;

type PolyFeature = Feature<Polygon>;

/** Split a country into its separate land masses. */
function polygonsOf(f: Country): PolyFeature[] {
  const g = f.geometry as Polygon | MultiPolygon;
  const rings: Position[][][] = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return rings.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } }));
}

/**
 * The part of the country to show: the land mass the city is on, plus any other
 * pieces nearby (so Denmark keeps its islands, but France drops French Guiana).
 */
function regionAround(f: Country, lng: number, lat: number): FeatureCollection {
  const polys = polygonsOf(f);
  if (polys.length <= 1) return { type: "FeatureCollection", features: polys };

  const city: [number, number] = [lng, lat];
  const main = polys.find((p) => geoContains(p, city)) ?? nearestPiece(polys, city);

  const c = geoCentroid(main);
  const [[x0, y0], [x1, y1]] = geoBounds(main);
  const radius = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map((p) => geoDistance(c, p as [number, number])));
  const reach = Math.max(0.2, radius * 0.9); // radians; 0.2 ≈ 1,300 km

  return {
    type: "FeatureCollection",
    features: polys.filter((p) => p === main || geoDistance(geoCentroid(p), c) < reach),
  };
}

/**
 * Coastal cities often sit just outside the simplified outline (New York, say).
 * Take the biggest land mass within ~60 km, so it's the mainland, not a nearby islet.
 */
function nearestPiece(polys: PolyFeature[], city: [number, number]): PolyFeature {
  const distance = (p: PolyFeature) =>
    Math.min(...p.geometry.coordinates[0].map((pt) => geoDistance(city, pt as [number, number])));
  const close = polys.filter((p) => distance(p) < 0.01); // 0.01 rad ≈ 64 km
  if (close.length) return close.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
  return polys.reduce((a, b) => (distance(b) < distance(a) ? b : a));
}

/** A small map of the country a postcard came from, with the city marked. */
export function CountryOutline({
  countryCode,
  countryName,
  city,
  lat,
  lng,
}: {
  countryCode: string;
  countryName: string;
  city: string;
  lat: number;
  lng: number;
}) {
  const [world, setWorld] = useState<Country[] | null>(null);
  useEffect(() => {
    loadWorld("50m").then(setWorld);
  }, []);

  const drawing = useMemo(() => {
    if (!world) return null;
    const key = countryKeyFromAlpha2(countryCode);
    const country = world.find((f) => countryKeyFromFeature(f) === key);
    if (!country) return null;

    const region = regionAround(country, lng, lat);
    const projection = geoMercator()
      // Centre on the region itself, so countries that cross the date line
      // (Russia, Fiji, Kiribati) don't get split across both edges of the map.
      .rotate([-geoCentroid(region)[0], 0])
      .fitExtent(
        [
          [PAD, PAD],
          [W - PAD, H - PAD],
        ],
        region,
      )
      .clipExtent([
        [0, 0],
        [W, H],
      ]);
    const path = geoPath(projection);
    const dot = projection([lng, lat]);

    return {
      neighbours: world.filter((f) => f !== country).map((f) => path(f) ?? ""),
      country: path(country) ?? "",
      dot,
    };
  }, [world, countryCode, lat, lng]);

  if (!world) {
    return <div className="aspect-[32/22] w-full animate-pulse rounded-xl bg-paper-deep" aria-hidden="true" />;
  }
  if (!drawing) return null; // country not in the map data — skip quietly

  const [dx, dy] = drawing.dot ?? [W / 2, H / 2];
  const labelLeft = dx > W * 0.6; // keep the city name inside the box

  return (
    <figure className="overflow-hidden rounded-xl border border-ink/10 bg-[#dfeaee]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${city} in ${countryName}`}>
        {drawing.neighbours.map((d, i) => (
          <path key={i} d={d} fill="#efe8da" stroke="#fff" strokeWidth={0.6} />
        ))}
        <path d={drawing.country} fill="#f3d3a4" stroke="#9a5a12" strokeOpacity={0.7} strokeWidth={1.1} strokeLinejoin="round" />
        {drawing.dot && (
          <g>
            <circle cx={dx} cy={dy} r={9} fill="#c2503a" fillOpacity={0.22} />
            <circle cx={dx} cy={dy} r={4.2} fill="#c2503a" stroke="#fff" strokeWidth={1.6} />
            <text
              x={labelLeft ? dx - 9 : dx + 9}
              y={dy + 4}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize={11}
              fontWeight={600}
              fill="#2a2622"
              stroke="#fbf8f2"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {city}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="px-3 py-1.5 text-xs text-ink-soft">{countryName}</figcaption>
    </figure>
  );
}
