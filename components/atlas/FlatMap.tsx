"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { FeatureCollection } from "geojson";
import type { CityGroup, LocatedMapCard, RouteRole, Selection } from "@/lib/atlas";
import { countryKeyFromFeature } from "@/lib/countries";
import { PLAIN, type MapStyle } from "@/lib/mapStyle";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";
import { loadWorld, type Country } from "@/lib/world";

const LABEL_HALO = "#fbf8f2";
const INK = "#2a2622";
const HOME_R = 5.5; // screen px
const CITY_R = 3.5;
const LABEL_ZOOM = 3; // show city/member names from this zoom level
const SMALL_COUNTRY_PX2 = 60; // countries smaller than this on screen get a highlight circle

export function FlatMap({
  cards,
  cities,
  sentFrom,
  homes,
  members,
  membersById,
  filterId,
  selection,
  onSelect,
  awaiting,
  showArcs = true,
  mapStyle = PLAIN,
  roles,
  involvedMembers,
  focusCities,
  progress,
}: {
  /** Replay: how far along its route each card is (0–1). Routes are drawn that far. */
  progress?: Map<string, number>;
  mapStyle?: MapStyle;
  /** With a person selected: which cards they sent ("out"), received ("in"), or neither ("other"). */
  roles?: Map<string, RouteRole>;
  involvedMembers?: Set<string>;
  focusCities?: Set<string>;
  cards: LocatedMapCard[];
  cities: CityGroup[];
  sentFrom: Set<string>;
  homes: Map<string, MemberWithAvatar>;
  members: MemberWithAvatar[];
  membersById: Map<string, MemberWithAvatar>;
  filterId: string | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  awaiting?: Set<string>;
  showArcs?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const fittedOnce = useRef(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [world, setWorld] = useState<Country[] | null>(null);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    loadWorld("50m").then(setWorld);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { projection, landBounds } = useMemo(() => {
    if (!size || !world) return { projection: null, landBounds: null };
    const land: FeatureCollection = { type: "FeatureCollection", features: world };
    const projection = geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [size.w - 8, size.h - 8],
      ],
      land,
    );
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(land);
    return {
      projection,
      landBounds: [
        [x0 - 8, y0 - 8],
        [x1 + 8, y1 + 8],
      ] as [[number, number], [number, number]],
    };
  }, [size, world]);

  const project = useCallback(
    (lng: number, lat: number): [number, number] | null => (projection ? projection([lng, lat]) : null),
    [projection],
  );

  const countryPaths = useMemo(() => {
    if (!projection || !world) return [];
    const path = geoPath(projection);
    return world.map((f, i) => ({
      id: `${f.id ?? f.properties.name}-${i}`,
      key: countryKeyFromFeature(f),
      name: f.properties.name,
      colorIndex: f.properties.colorIndex,
      d: path(f) ?? "",
      area: path.area(f),
      centroid: path.centroid(f),
    }));
  }, [projection, world]);

  const graticule = useMemo(() => (projection ? (geoPath(projection)(geoGraticule10()) ?? "") : ""), [projection]);
  const sphere = useMemo(() => (projection ? (geoPath(projection)({ type: "Sphere" }) ?? "") : ""), [projection]);

  // Birds only fly for people who haven't asked their OS to reduce motion.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Members with a card in the current view (for dimming when filtered).
  // Members to keep bright when a person is selected (them + whoever they swapped cards with).
  const involved = useMemo(() => {
    const s = new Set<string>(involvedMembers ?? []);
    if (filterId) s.add(filterId);
    if (!involvedMembers) {
      for (const c of cards) {
        s.add(c.sender_id);
        s.add(c.recipient_id);
      }
    }
    awaiting?.forEach((id) => s.add(id));
    return s;
  }, [cards, filterId, awaiting, involvedMembers]);

  const arcs = useMemo(() => {
    if (!showArcs) return [];
    // Faded routes first, so the selected person's routes are drawn on top.
    const ordered = roles
      ? [...cards].sort((a, b) => Number(roles.get(a.id) !== "other") - Number(roles.get(b.id) !== "other"))
      : cards;
    return ordered.flatMap((c, i) => {
      const recipient = membersById.get(c.recipient_id);
      const sender = membersById.get(c.sender_id);
      if (!recipient) return [];
      const a = project(c.from_lng, c.from_lat);
      const to = destinationOf(c, recipient)!; // the address it was sent to
      const b = project(to.lng, to.lat);
      if (!a || !b) return [];
      const [x1, y1] = a;
      const [x2, y2] = b;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) return []; // sent from the recipient's own city
      // Bend the line upward into an arc, more for longer distances.
      let nx = -dy / len;
      let ny = dx / len;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const bend = len * 0.22;
      const cx = (x1 + x2) / 2 + nx * bend;
      const cy = (y1 + y2) / 2 + ny * bend;
      // Bird flight time: longer routes take longer, within reason.
      const duration = Math.min(9, Math.max(3, len / 70));
      return [
        {
          card: c,
          color: sender?.color ?? INK,
          d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`,
          curve: { x1, y1, cx, cy, x2, y2 },
          end: [x2, y2] as const,
          angle: (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI,
          duration,
          delay: (i * 1.7) % duration, // stagger so the birds don't fly in formation
        },
      ];
    });
  }, [cards, membersById, project, showArcs, roles]);

  // ─── Zoom & pan ──────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!size || !svg || !landBounds) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      // Default is 0px, so the slightest wobble turns a tap into a drag and eats the click.
      .clickDistance(6)
      .tapDistance(12)
      .extent([
        [0, 0],
        [size.w, size.h],
      ])
      // Can't pan past the edge of the land into blank space.
      .translateExtent(landBounds)
      .on("zoom", (e: { transform: ZoomTransform }) => setT(e.transform));
    const sel = select(svg);
    sel.call(z);
    zoomRef.current = z;
    return () => {
      sel.on(".zoom", null);
    };
  }, [size, landBounds]);

  /** Zoom so every visible card and relevant home fits on screen. */
  const fitTransform = useCallback((): ZoomTransform => {
    if (!size) return zoomIdentity;
    const pts: [number, number][] = [];
    for (const c of cities) {
      if (filterId && focusCities && !focusCities.has(c.key)) continue; // zoom to the selected person's routes
      const p = project(c.lng, c.lat);
      if (p) pts.push(p);
    }
    for (const m of members) {
      if (filterId && !involved.has(m.id)) continue;
      const p = project(m.home_lng, m.home_lat);
      if (p) pts.push(p);
    }
    if (!pts.length) return zoomIdentity;

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const bw = Math.max(maxX - minX, 60);
    const bh = Math.max(maxY - minY, 60);
    const k = Math.min(Math.max(Math.min(size.w / (bw * 1.5), size.h / (bh * 1.5)), 1), 8);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return zoomIdentity.translate(size.w / 2 - k * cx, size.h / 2 - k * cy).scale(k);
  }, [size, cities, members, filterId, involved, project, focusCities]);

  const zoomTo = useCallback(
    (target: ZoomTransform | ((cur: ZoomTransform) => ZoomTransform), ms = 600) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (!svg || !z) return;
      const sel = select(svg);
      const next = typeof target === "function" ? target(t) : target;
      if (ms === 0) sel.call(z.transform, next);
      else sel.transition().duration(ms).call(z.transform, next);
    },
    [t],
  );

  // Fit on first render, on resize and when the member filter changes.
  useEffect(() => {
    if (!projection) return;
    zoomTo(fitTransform(), fittedOnce.current ? 700 : 0);
    fittedOnce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, filterId]);

  const k = t.k;
  const showLabels = k >= LABEL_ZOOM;
  const selectedCardId = selection?.kind === "card" ? selection.id : null;
  const selectedCity = selection?.kind === "city" ? selection.key : null;
  const selectedMember = selection?.kind === "member" ? selection.id : null;

  // Labels: outlined text that stays the same size on screen.
  const label = (x: number, y: number, text: string, opts?: { bold?: boolean; dx?: number; dy?: number }) => (
    <text
      x={x + (opts?.dx ?? CITY_R + 4) / k}
      y={y + (opts?.dy ?? 4) / k}
      fontSize={11 / k}
      fontWeight={opts?.bold ? 600 : 500}
      fill={INK}
      stroke={LABEL_HALO}
      strokeWidth={3 / k}
      strokeLinejoin="round"
      paintOrder="stroke"
      pointerEvents="none"
      className="select-none"
    >
      {text}
    </text>
  );

  return (
    <div ref={containerRef} className="absolute inset-0">
      {!world && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">Unfolding the map…</div>
      )}
      {size && projection && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block cursor-grab touch-none select-none active:cursor-grabbing"
          onClick={() => onSelect(null)}
        >
          <defs>
            <filter id="stamp-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#2a2622" floodOpacity="0.4" />
            </filter>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke={INK} strokeOpacity="0.28" strokeWidth="0.9" />
            </pattern>
          </defs>
          <g transform={t.toString()}>
            {mapStyle.ocean && <path d={sphere} fill={mapStyle.ocean} />}
            <path
              d={graticule}
              fill="none"
              stroke={mapStyle.graticule}
              strokeOpacity={mapStyle.graticuleOpacity}
              vectorEffect="non-scaling-stroke"
            />

            {countryPaths.map((c) => {
              const home = c.key ? homes.get(c.key) : undefined;
              const sent = c.key ? sentFrom.has(c.key) : false;
              const dimHome = !!filterId && !!home && !involved.has(home.id);
              return (
                <g key={c.id}>
                  <path
                    d={c.d}
                    fill={home ? home.color : sent ? mapStyle.sentFrom : mapStyle.land(c.colorIndex)}
                    fillOpacity={home ? (dimHome ? 0.22 : mapStyle.homeOpacity) : 1}
                    stroke={sent && !home ? mapStyle.sentFromEdge : mapStyle.border}
                    strokeOpacity={sent && !home ? 0.6 : 1}
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{c.name}</title>
                  </path>
                  {sent && <path d={c.d} fill="url(#hatch)" pointerEvents="none" />}
                </g>
              );
            })}

            {/* Tiny countries (islands, microstates) get a circle so they're visible at world zoom */}
            {countryPaths.map((c) => {
              if (!c.key || c.area * k * k > SMALL_COUNTRY_PX2) return null;
              const home = homes.get(c.key);
              const sent = sentFrom.has(c.key);
              if (!home && !sent) return null;
              const [x, y] = c.centroid;
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              return (
                <circle
                  key={`halo-${c.id}`}
                  cx={x}
                  cy={y}
                  r={9 / k}
                  fill={home ? home.color : mapStyle.sentFrom}
                  fillOpacity={0.35}
                  stroke={home ? home.color : mapStyle.sentFromEdge}
                  strokeWidth={1.5 / k}
                  pointerEvents="none"
                />
              );
            })}

            {arcs.map((a) => {
              const selected = a.card.id === selectedCardId;
              const transit = a.card.status === "in_transit";
              // With a person selected: their sent cards solid, received cards dotted, the rest faded.
              const role = roles?.get(a.card.id);
              const faded = role === "other";
              const highlighted = role === "out" || role === "in";
              const opacity = faded ? 0.14 : selectedCardId && !selected ? 0.45 : 0.95;

              // Replay: a card still in the post is drawn only as far as it has travelled,
              // with its bird at the tip.
              const p = progress?.get(a.card.id);
              if (p !== undefined && p < 1) {
                const part = partialCurve(a.curve, p);
                return (
                  <g key={a.card.id} pointerEvents="none">
                    <path
                      d={part.d}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={highlighted ? 3 : faded ? 1.5 : 2.5}
                      strokeLinecap="round"
                      strokeOpacity={opacity}
                      vectorEffect="non-scaling-stroke"
                    />
                    {!faded && (
                      <g transform={`translate(${part.x},${part.y}) rotate(${part.angle}) scale(${1.5 / k})`}>
                        <Bird color={a.color} />
                      </g>
                    )}
                  </g>
                );
              }

              return (
                <g key={a.card.id}>
                  <path
                    d={a.d}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={selected ? 3.5 : highlighted ? 3 : faded ? 1.5 : 2}
                    strokeLinecap="round"
                    strokeOpacity={opacity}
                    strokeDasharray={role === "in" ? "0.1 6" : undefined}
                    vectorEffect="non-scaling-stroke"
                    className={transit && role !== "in" ? "arc-transit" : undefined}
                    pointerEvents="none"
                  />
                  <path
                    d="M0,0 L-7,-3.5 L-7,3.5 Z"
                    fill={a.color}
                    fillOpacity={faded ? 0.14 : selectedCardId && !selected ? 0.45 : 1}
                    transform={`translate(${a.end[0]},${a.end[1]}) rotate(${a.angle}) translate(${-(HOME_R + 1.5) / k},0) scale(${1 / k})`}
                    pointerEvents="none"
                  />
                  {/* Wide invisible hit area so thin arcs are easy to tap */}
                  <path
                    d={a.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="stroke"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ kind: "card", id: a.card.id });
                    }}
                  >
                    <title>
                      {membersById.get(a.card.sender_id)?.display_name} → {membersById.get(a.card.recipient_id)?.display_name}
                      {transit ? " (in transit)" : ""}
                    </title>
                  </path>
                  {/* A little bird carrying the postcard along its route (not in the replay: it's landed) */}
                  {!reducedMotion && !faded && !progress && (
                    <g pointerEvents="none">
                      <animateMotion
                        dur={`${a.duration}s`}
                        begin={`-${a.delay}s`}
                        repeatCount="indefinite"
                        rotate="auto"
                        path={a.d}
                      />
                      <g transform={`scale(${1.5 / k})`}>
                        <Bird color={a.color} />
                      </g>
                    </g>
                  )}
                </g>
              );
            })}

            {cities.map((c) => {
              const p = project(c.lng, c.lat);
              if (!p) return null;
              const selected = c.key === selectedCity;
              const faded = !!filterId && !!focusCities && !focusCities.has(c.key);
              return (
                <g key={c.key} opacity={faded ? 0.3 : 1}>
                  <StampPin
                    x={p[0]}
                    y={p[1]}
                    k={k}
                    code={c.countryCode}
                    selected={selected}
                    count={c.cards.length}
                    onClick={() => onSelect({ kind: "city", key: c.key })}
                    title={`${c.name}, ${c.country} · ${c.cards.length} ${c.cards.length === 1 ? "card" : "cards"}`}
                  />
                  {(showLabels || selected) && label(p[0], p[1], c.name, { dx: 13 })}
                </g>
              );
            })}

            {members.map((m) => {
              const p = project(m.home_lng, m.home_lat);
              if (!p) return null;
              const dim = !!filterId && !involved.has(m.id);
              const selected = m.id === selectedMember;
              const r = (selected ? HOME_R + 1.5 : HOME_R) / k;
              return (
                <g
                  key={m.id}
                  opacity={dim ? 0.35 : 1}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ kind: "member", id: m.id });
                  }}
                >
                  {awaiting?.has(m.id) && (
                    // Something's on its way here: a pulsing ring
                    <circle cx={p[0]} cy={p[1]} r={r} fill="none" stroke={m.color} strokeWidth={2 / k} pointerEvents="none">
                      <animate attributeName="r" values={`${r};${r * 3.2}`} dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={p[0]} cy={p[1]} r={r} fill={m.color} stroke="#fff" strokeWidth={2 / k} />
                  <circle cx={p[0]} cy={p[1]} r={r * 0.32} fill="#fff" />
                  <title>
                    {m.display_name} · home in {m.home_city}
                  </title>
                  {(showLabels || selected) && label(p[0], p[1], `${m.display_name} · ${m.home_city}`, { bold: true })}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {projection && (
        <div className="absolute left-3 top-3 z-[5] flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white/90 shadow-sm backdrop-blur">
          {[
            { label: "Zoom in", text: "+", fn: () => zoomTo((cur) => scaleAroundCenter(cur, 2, size!), 300) },
            { label: "Zoom out", text: "−", fn: () => zoomTo((cur) => scaleAroundCenter(cur, 1 / 2, size!), 300) },
            { label: "Fit postcards", text: "⤢", fn: () => zoomTo(fitTransform()) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              title={b.label}
              onClick={b.fn}
              className="flex size-9 items-center justify-center border-b border-ink/10 text-lg last:border-b-0 hover:bg-paper"
            >
              {b.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A tiny postage stamp: the country's flag on white paper with a perforated
 * edge (a dotted round-capped stroke in the paper colour makes the scallops).
 * Drawn in screen pixels, so it stays the same size at any zoom.
 */
function StampPin({
  x,
  y,
  k,
  code,
  selected,
  count,
  onClick,
  title,
}: {
  x: number;
  y: number;
  k: number;
  code: string;
  selected: boolean;
  count: number;
  onClick: () => void;
  title: string;
}) {
  const w = selected ? 20 : 15;
  const h = w * 0.75;
  const cc = code.toLowerCase();
  return (
    <g
      transform={`translate(${x},${y}) scale(${1 / k})`}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <title>{title}</title>
      <g filter="url(#stamp-shadow)">
        <rect
          x={-w / 2 - 2}
          y={-h / 2 - 2}
          width={w + 4}
          height={h + 4}
          fill="#fffdf7"
          stroke="#fffdf7"
          strokeWidth="2.4"
          strokeDasharray="0.01 2.7"
          strokeLinecap="round"
        />
      </g>
      <image
        href={`https://flagcdn.com/w40/${cc}.png`}
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        preserveAspectRatio="none"
      />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#2a2622" strokeOpacity="0.2" strokeWidth="0.6" />
      {count > 1 && (
        <g transform={`translate(${w / 2 + 1},${-h / 2 - 1})`}>
          <circle r="5.5" fill="#c2503a" stroke="#fff" strokeWidth="1.2" />
          <text y="2.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">
            {count}
          </text>
        </g>
      )}
    </g>
  );
}

/** The first `t` (0–1) of a quadratic curve, plus the point and heading at its tip. */
function partialCurve(
  c: { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number },
  t: number,
) {
  const s = Math.max(0.001, Math.min(1, t));
  const lerp = (a: number, b: number) => a + (b - a) * s;
  const q0x = lerp(c.x1, c.cx);
  const q0y = lerp(c.y1, c.cy);
  const q1x = lerp(c.cx, c.x2);
  const q1y = lerp(c.cy, c.y2);
  const x = q0x + (q1x - q0x) * s;
  const y = q0y + (q1y - q0y) * s;
  return {
    d: `M${c.x1},${c.y1} Q${q0x},${q0y} ${x},${y}`,
    x,
    y,
    angle: (Math.atan2(q1y - q0y, q1x - q0x) * 180) / Math.PI,
  };
}

/** Top-down bird flying along +x, wings flapping. ~18px wingspan before scaling. */
function Bird({ color }: { color: string }) {
  return (
    <g>
      <g>
        <animateTransform attributeName="transform" type="scale" values="1 1;1 0.3;1 1" dur="0.42s" repeatCount="indefinite" />
        <path
          d="M1,0 C0,-3 -3,-7 -7,-9 C-5,-5 -4.5,-2.5 -3,0 C-4.5,2.5 -5,5 -7,9 C-3,7 0,3 1,0 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      </g>
      <path d="M-6,0 L-9.5,-2.2 L-8.5,0 L-9.5,2.2 Z" fill={color} stroke="#fff" strokeWidth="0.7" strokeLinejoin="round" />
      <ellipse cx="-1.5" cy="0" rx="4.5" ry="1.8" fill={color} stroke="#fff" strokeWidth="0.9" />
      <circle cx="2.6" cy="0" r="1.6" fill={color} stroke="#fff" strokeWidth="0.7" />
    </g>
  );
}

function scaleAroundCenter(cur: ZoomTransform, factor: number, size: { w: number; h: number }): ZoomTransform {
  const k = Math.min(Math.max(cur.k * factor, 1), 60);
  const cx = size.w / 2;
  const cy = size.h / 2;
  // Keep the point under the centre of the screen fixed.
  const [x, y] = cur.invert([cx, cy]);
  return zoomIdentity.translate(cx - k * x, cy - k * y).scale(k);
}
