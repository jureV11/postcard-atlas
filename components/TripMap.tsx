"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { countryKeyFromAlpha2, countryKeyFromFeature } from "@/lib/countries";
import type { MeetupStop } from "@/lib/types";
import { loadWorld, type Country } from "@/lib/world";

const W = 320;
const H = 220;
const PAD = 26;
const MIN_SPAN = 3; // degrees: two stops in one region still show the land around them
const MAX_LABELS = 6; // more stops than this: numbers only (the names are listed above the map)

/** A trip through several places: the countries we went to, the stops numbered and joined up in order. */
export function TripMap({ stops }: { stops: MeetupStop[] }) {
  const [world, setWorld] = useState<Country[] | null>(null);
  useEffect(() => {
    loadWorld("50m").then(setWorld);
  }, []);

  const drawing = useMemo(() => {
    if (!world) return null;
    const lngs = stops.map((s) => s.lng);
    const lats = stops.map((s) => s.lat);
    const pad = (lo: number, hi: number) => {
      const extra = Math.max(0, MIN_SPAN - (hi - lo)) / 2;
      return [lo - extra, hi + extra];
    };
    const [x0, x1] = pad(Math.min(...lngs), Math.max(...lngs));
    const [y0, y1] = pad(Math.min(...lats), Math.max(...lats));
    const projection = geoMercator()
      .rotate([-(x0 + x1) / 2, 0]) // centred on the trip, so one across the date line isn't split
      .fitExtent(
        [
          [PAD, PAD],
          [W - PAD, H - PAD],
        ],
        { type: "MultiPoint", coordinates: [[x0, Math.max(-80, y0)], [x1, Math.min(80, y1)]] },
      )
      .clipExtent([
        [0, 0],
        [W, H],
      ]);
    const path = geoPath(projection);
    const visited = new Set(stops.map((s) => countryKeyFromAlpha2(s.countryCode)).filter(Boolean));
    return {
      countries: world.map((c) => {
        const key = countryKeyFromFeature(c);
        return { d: path(c) ?? "", visited: !!key && visited.has(key) };
      }),
      points: stops.map((s) => projection([s.lng, s.lat]) ?? [W / 2, H / 2]),
    };
  }, [world, stops]);

  if (!drawing) return <div className="aspect-[32/22] w-full animate-pulse rounded-xl bg-paper-deep" aria-hidden="true" />;

  const countries = [...new Set(stops.map((s) => s.country).filter(Boolean))];
  return (
    <figure className="overflow-hidden rounded-xl border border-ink/10 bg-[#dfeaee]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`A trip: ${stops.map((s) => s.name).join(", then ")}`}>
        {drawing.countries.map((c, i) =>
          c.visited ? null : <path key={i} d={c.d} fill="#efe8da" stroke="#fff" strokeWidth={0.6} />,
        )}
        {/* The countries we went to, on top so their borders show */}
        {drawing.countries.map((c, i) =>
          c.visited ? (
            <path key={i} d={c.d} fill="#f3d3a4" stroke="#9a5a12" strokeOpacity={0.7} strokeWidth={1.1} strokeLinejoin="round" />
          ) : null,
        )}
        <path
          d={drawing.points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("")}
          fill="none"
          stroke="#c2503a"
          strokeWidth={1.6}
          strokeDasharray="4 3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {drawing.points.map(([x, y], i) => {
          const left = x > W * 0.6; // keep the name inside the box
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={7.5} fill="#c2503a" stroke="#fff" strokeWidth={1.5} />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff">
                {i + 1}
              </text>
              {stops.length <= MAX_LABELS && (
                <text
                  x={left ? x - 11 : x + 11}
                  y={y + 4}
                  textAnchor={left ? "end" : "start"}
                  fontSize={11}
                  fontWeight={600}
                  fill="#2a2622"
                  stroke="#fbf8f2"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {stops[i].name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="px-3 py-1.5 text-xs text-ink-soft">
        {stops.length} stops{countries.length ? ` · ${countries.join(", ")}` : ""}
      </figcaption>
    </figure>
  );
}
