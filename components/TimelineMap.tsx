"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { loadWorld, type Country } from "@/lib/world";

export type MeetupPlace = { id: string; title: string; dates: string; city: string | null; lat: number; lng: number };

const W = 800;
const H = 440;
const PAD = 48;
const MIN_SPAN = 14; // degrees: even if every meetup was in one town, show the area around it

/**
 * Every place we met up, as pins on a map that fits them all. Tap a pin for the
 * meetups there. Zoom with the scroll wheel, the + / − buttons or a pinch, and
 * drag to move around, so pins close together can be told apart. Scrolling down
 * when it's fully zoomed out, or a one-finger swipe, still scrolls the page.
 */
export function TimelineMap({ places }: { places: MeetupPlace[] }) {
  const [world, setWorld] = useState<Country[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    let live = true;
    loadWorld("110m").then((w) => live && setWorld(w));
    return () => {
      live = false;
    };
  }, []);

  // Meetups in the same town share one pin
  const pins = useMemo(() => {
    const byPlace = new Map<string, { key: string; lat: number; lng: number; meetups: MeetupPlace[] }>();
    for (const p of places) {
      const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
      const pin = byPlace.get(key) ?? { key, lat: p.lat, lng: p.lng, meetups: [] };
      pin.meetups.push(p);
      byPlace.set(key, pin);
    }
    return [...byPlace.values()];
  }, [places]);

  const drawing = useMemo(() => {
    if (!world || !pins.length) return null;
    // Fit the pins, but never closer in than MIN_SPAN degrees
    const lngs = pins.map((p) => p.lng);
    const lats = pins.map((p) => p.lat);
    const pad = (lo: number, hi: number) => {
      const extra = Math.max(0, MIN_SPAN - (hi - lo)) / 2;
      return [lo - extra, hi + extra];
    };
    const [x0, x1] = pad(Math.min(...lngs), Math.max(...lngs));
    const [y0, y1] = pad(Math.min(...lats), Math.max(...lats));
    const projection = geoMercator().fitExtent(
      [
        [PAD, PAD],
        [W - PAD, H - PAD],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [x0, Math.max(-80, y0)],
          [x1, Math.min(80, y1)],
        ],
      },
    );
    const path = geoPath(projection);
    return {
      countries: world.map((c) => path(c) ?? ""),
      pins: pins.map((p) => {
        const [x, y] = projection([p.lng, p.lat]) ?? [0, 0];
        return { ...p, x, y };
      }),
    };
  }, [world, pins]);

  const ready = !!drawing;
  useEffect(() => {
    const svg = svgRef.current;
    if (!ready || !svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .extent([
        [0, 0],
        [W, H],
      ])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .clickDistance(6) // a tap on a pin isn't a drag
      .tapDistance(12)
      // The wheel zooms, except outward when it's already all the way out: then the page
      // scrolls on past the map. One finger only scrolls the page; two pinch.
      .filter((e: Event) =>
        e.type === "wheel"
          ? (e as WheelEvent).deltaY < 0 || zoomTransform(svg).k > 1.001
          : e.type === "touchstart"
            ? (e as TouchEvent).touches.length > 1
            : !(e as MouseEvent).button,
      )
      .on("zoom", (e: { transform: ZoomTransform }) => setT(e.transform));
    const sel = select(svg);
    sel.call(z);
    zoomRef.current = z;
    return () => {
      sel.on(".zoom", null);
    };
  }, [ready]);

  const zoomBy = (k: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(250).call(zoomRef.current.scaleBy, k);
  };
  const reset = () => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(250).call(zoomRef.current.transform, zoomIdentity);
  };

  if (!places.length) return null;
  const chosen = pins.find((p) => p.key === picked);
  const zoomButton =
    "flex size-9 items-center justify-center rounded-full bg-[#fffdf8] text-lg font-semibold text-ink shadow ring-1 ring-ink/10 hover:bg-white";

  return (
    <section className="mx-auto mt-8 max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Where we&apos;ve met up</h2>
        <p className="text-sm text-ink-soft">
          {pins.length} {pins.length === 1 ? "place" : "places"} · tap a pin · scroll, pinch or + / − to zoom
        </p>
      </div>
      {drawing ? (
        <figure className="relative overflow-hidden rounded-xl border border-ink/10 bg-[#dfeaee]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
            role="img"
            aria-label="Map of the places we met up"
          >
            <g transform={t.toString()}>
              {drawing.countries.map((d, i) => (
                <path key={i} d={d} fill="#efe8da" stroke="#fff" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            {/* Pins stay the same size however far you zoom in, so close ones pull apart */}
            {drawing.pins.map(({ x: px, y: py, ...p }) => {
              const [x, y] = t.apply([px, py]);
              const on = p.key === picked;
              const n = p.meetups.length;
              return (
                <g
                  key={p.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.meetups[0].city ?? "A place"}: ${n} ${n === 1 ? "meetup" : "meetups"}`}
                  className="cursor-pointer outline-none"
                  onClick={() => setPicked(on ? null : p.key)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPicked(on ? null : p.key)}
                >
                  <title>{p.meetups.map((m) => m.title).join(", ")}</title>
                  {/* A wider invisible ring, so a small pin is still easy to tap */}
                  <circle cx={x} cy={y} r={14} fill="transparent" />
                  <circle cx={x} cy={y} r={on ? 10 : 8} fill="#c2503a" fillOpacity={0.18} />
                  <circle
                    cx={x}
                    cy={y}
                    r={n > 1 ? (on ? 6.5 : 5.5) : on ? 4.5 : 3.5}
                    fill={on ? "#2a2622" : "#c2503a"}
                    stroke="#fff"
                    strokeWidth={1.2}
                  />
                  {n > 1 && (
                    <text x={x} y={y + 2.6} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff">
                      {n}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button type="button" className={zoomButton} aria-label="Zoom in" onClick={() => zoomBy(2)}>
              +
            </button>
            <button type="button" className={zoomButton} aria-label="Zoom out" onClick={() => zoomBy(0.5)}>
              −
            </button>
            {t.k > 1.01 && (
              <button type="button" className={`${zoomButton} text-sm`} aria-label="Show everything" title="Show everything" onClick={reset}>
                ⤢
              </button>
            )}
          </div>
        </figure>
      ) : (
        <div className="aspect-[80/44] w-full animate-pulse rounded-xl bg-paper-deep" aria-hidden="true" />
      )}
      {chosen && (
        <ul className="card divide-y divide-ink/10 p-2">
          {chosen.meetups.map((m) => (
            <li key={m.id}>
              <Link href={`/timeline/${m.id}`} className="flex items-baseline justify-between gap-3 rounded-[6px] px-2 py-2 hover:bg-paper-deep/60">
                <span className="min-w-0 truncate font-medium">{m.title}</span>
                <span className="shrink-0 text-sm text-ink-soft">
                  {m.city} · {m.dates}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
