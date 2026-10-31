"use client";

// Loaded with next/dynamic (ssr: false) — three.js needs `window`.
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import type { CityGroup, LocatedMapCard, OldHome, RouteRole, Selection } from "@/lib/atlas";
import { countryKeyFromFeature } from "@/lib/countries";
import { PLAIN, type MapStyle } from "@/lib/mapStyle";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";
import { capGeometry, capResolution, isTiny } from "@/lib/globeShapes";
import { escapeHtml } from "@/lib/utils";
import { loadGlobeWorld, type Country } from "@/lib/world";
import { isWater, lostPoint, lostSvg } from "./bird";
import { houseSvg } from "./house";

const OCEAN = "#dde6e8";
const LAND = "#e9e0cd";
const SENT_FROM = "#e9c48c";
const INK = "#2a2622";
const SIDE = () => "rgba(42,38,34,0.04)";
const STROKE = () => "rgba(255,255,255,0.7)";
// The globe's types say a shape's coordinates are a flat number[] (they're nested
// arrays, as in any GeoJSON); the cast only quiets that.
const CAP_GEOMETRY = capGeometry as unknown as ComponentProps<typeof Globe>["polygonGeoJsonGeometry"];
/** Closest and furthest the camera goes, in globe radii above the surface. */
const MIN_ALTITUDE = 0.05;
const MAX_ALTITUDE = 4;

type ArcDatum = {
  kind: "line" | "comet";
  /** Lost in the post: drawn only as far as where it went missing. */
  lost?: boolean;
  role: RouteRole | null; // with a person selected: "out" solid, "in" dotted, "other" faded
  card: LocatedMapCard;
  color: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  offset: number;
};

type LostDatum = { kind: "lost"; lat: number; lng: number; card: LocatedMapCard; color: string; water: boolean; dim: boolean };

type PointDatum =
  | LostDatum
  | { kind: "city"; lat: number; lng: number; city: CityGroup; dim: boolean }
  | { kind: "home"; lat: number; lng: number; member: MemberWithAvatar; dim: boolean; style: "house" | "dot" }
  | { kind: "old"; lat: number; lng: number; old: OldHome; member: MemberWithAvatar; dim: boolean; style: "house" | "dot" };

export default function GlobeView({
  cards,
  cities,
  sentFrom,
  homes,
  oldHomes = [],
  oldHomeCountries,
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
  routeColors,
  homeStyle = "house",
  showNames = false,
}: {
  /** Names next to pins (when zoomed in). Off by default: it gets crowded. */
  showNames?: boolean;
  /** Home markers: little houses with their photo, or the classic round dots. */
  homeStyle?: "house" | "dot";
  /** Flag routes: colours of each origin country's flag (lower-case code → colours). */
  routeColors?: Map<string, string[]>;
  roles?: Map<string, RouteRole>;
  involvedMembers?: Set<string>;
  focusCities?: Set<string>;
  showArcs?: boolean;
  mapStyle?: MapStyle;
  awaiting?: Set<string>;
  cards: LocatedMapCard[];
  cities: CityGroup[];
  sentFrom: Set<string>;
  homes: Map<string, MemberWithAvatar>;
  oldHomes?: OldHome[];
  oldHomeCountries?: Map<string, MemberWithAvatar>;
  members: MemberWithAvatar[];
  membersById: Map<string, MemberWithAvatar>;
  filterId: string | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [world, setWorld] = useState<Country[]>([]);
  const [ready, setReady] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false); // show pin labels when close
  // Routes are tubes with a fixed width on the globe, so they'd look fatter the
  // closer you zoom. Shrink them with the camera height (in steps, so the arcs
  // aren't rebuilt on every frame of a zoom).
  const [strokeScale, setStrokeScale] = useState(1);
  // How high land, route ends and dots sit. Only three steps: every change
  // rebuilds the country shapes, which takes a moment.
  const lift = strokeScale >= 0.6 ? 1 : strokeScale >= 0.3 ? 0.5 : 0.25;
  // The globe is ready before its countries are built: keep the message up until they're on it.
  const [shaped, setShaped] = useState(false);

  useEffect(() => {
    loadGlobeWorld().then(setWorld);
  }, []);

  useEffect(() => {
    if (!world.length) return;
    // The globe builds the countries in a timer of its own, set before this one runs.
    const t = setTimeout(() => setShaped(true), 50);
    return () => clearTimeout(t);
  }, [world]);

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

  const material = useMemo(() => new MeshPhongMaterial({ color: OCEAN, shininess: 6 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.color.set(mapStyle.ocean ?? OCEAN);
  }, [material, mapStyle]);

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

  // Received cards: a solid line plus a light "comet" travelling along it.
  // In transit: marching dashes. With a person selected, other people's routes
  // are faded (and get no comet).
  const arcs = useMemo<ArcDatum[]>(
    () =>
      cards.flatMap((card) => {
        const r = membersById.get(card.recipient_id);
        if (!r) return [];
        const role = roles?.get(card.id) ?? null;
        const to = destinationOf(card, r)!; // the address it was sent to
        const base = {
          card,
          role,
          color: membersById.get(card.sender_id)?.color ?? INK,
          startLat: card.from_lat,
          startLng: card.from_lng,
          endLat: to.lat,
          endLng: to.lng,
        };
        if (card.status === "lost") {
          const [lng, lat] = lostPoint([card.from_lng, card.from_lat], [to.lng, to.lat]);
          return [{ ...base, endLat: lat, endLng: lng, kind: "line" as const, lost: true }];
        }
        return card.status === "received" && role !== "other"
          ? [
              { ...base, kind: "line" as const },
              { ...base, kind: "comet" as const },
            ]
          : [{ ...base, kind: "line" as const }];
        // Stagger the comets so they don't all move in sync (stable across renders).
      }).map((a, i) => ({ ...a, offset: (i * 0.37) % 1.4 })),
    [cards, membersById, roles],
  );

  // Where cards landed (one dot per address), in the sender's colour.
  const landings = useMemo(() => {
    const seen = new Map<string, { lat: number; lng: number; color: string }>();
    for (const a of arcs) {
      if (a.kind !== "line" || a.lost || a.card.status !== "received") continue;
      const key = `${a.endLat.toFixed(3)},${a.endLng.toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, { lat: a.endLat, lng: a.endLng, color: a.role === "other" ? withAlpha(a.color, 0.3) : a.color });
    }
    return [...seen.values()];
  }, [arcs]);

  const points = useMemo<PointDatum[]>(
    () => [
      ...cities.map((city) => ({
        kind: "city" as const,
        lat: city.lat,
        lng: city.lng,
        city,
        dim: !!filterId && !!focusCities && !focusCities.has(city.key),
      })),
      ...members.map((member) => ({
        kind: "home" as const,
        lat: member.home_lat,
        lng: member.home_lng,
        member,
        dim: !!filterId && !involved.has(member.id),
        style: homeStyle,
      })),
      ...oldHomes.map((old) => ({
        kind: "old" as const,
        lat: old.lat,
        lng: old.lng,
        old,
        member: old.member,
        dim: !!filterId && !involved.has(old.member.id),
        style: homeStyle,
      })),
      // Where lost cards went missing
      ...(showArcs ? arcs : [])
        .filter((a) => a.lost)
        .map((a) => ({
          kind: "lost" as const,
          lat: a.endLat,
          lng: a.endLng,
          card: a.card,
          color: a.color,
          water: isWater(world, [a.endLng, a.endLat]),
          dim: a.role === "other",
        })),
    ],
    [cities, members, oldHomes, filterId, involved, focusCities, homeStyle, arcs, world, showArcs],
  );

  // Pulsing rings at the homes of people with a card on its way.
  const rings = useMemo(
    () =>
      members
        .filter((m) => awaiting?.has(m.id))
        .map((m) => ({ lat: m.home_lat, lng: m.home_lng, color: m.color })),
    [members, awaiting],
  );

  // Auto-rotate gently until the user grabs the globe.
  useEffect(() => {
    const g = globeRef.current;
    if (!ready || !g) return;
    const controls = g.controls();
    // Scroll and pinch stop where the zoom buttons do (otherwise you can end up inside the globe).
    controls.minDistance = g.getGlobeRadius() * (1 + MIN_ALTITUDE);
    controls.maxDistance = g.getGlobeRadius() * (1 + MAX_ALTITUDE);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const stop = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [ready]);

  /** Turn to face the postcards (the selected person's, if any). */
  const faceCards = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const pts = [
      ...cities.filter((c) => !filterId || !focusCities || focusCities.has(c.key)).map((c) => [c.lat, c.lng]),
      ...members.filter((m) => !filterId || involved.has(m.id)).map((m) => [m.home_lat, m.home_lng]),
    ];
    if (!pts.length) return;
    g.pointOfView({ ...centroid(pts), altitude: pts.length > 1 ? 1.7 : 1.4 }, 1000);
  }, [cities, members, filterId, focusCities, involved]);

  // On load and whenever the filter changes.
  useEffect(() => {
    if (ready) faceCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filterId]);

  /** Zoom buttons: move the camera closer or further, keeping the same spot in view. */
  function zoomBy(factor: number) {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = false;
    const pov = g.pointOfView();
    g.pointOfView({ ...pov, altitude: Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, pov.altitude * factor)) }, 300);
  }

  // Stable so the globe doesn't rebuild every pin on each render.
  const makePin = useCallback(
    (d: object) => {
      const p = d as PointDatum;
      return p.kind === "lost" ? lostPinElement(p, onSelect) : pinElement(p, onSelect);
    },
    [onSelect],
  );

  const selectedCardId = selection?.kind === "card" ? selection.id : null;

  // Countries are only rebuilt when one of these accessors actually changes.
  const capColor = useCallback(
    (d: object) => {
      const key = countryKeyFromFeature(d as Country);
      const home = key ? homes.get(key) : undefined;
      if (home) return withAlpha(home.color, filterId && !involved.has(home.id) ? 0.25 : 0.6);
      // An old address's country: a lighter wash of their colour (the flat map stripes it).
      const old = key ? oldHomeCountries?.get(key) : undefined;
      if (old) return withAlpha(old.color, filterId && !involved.has(old.id) ? 0.15 : 0.38);
      if (key && sentFrom.has(key)) return mapStyle === PLAIN ? SENT_FROM : mapStyle.sentFrom;
      return mapStyle === PLAIN ? LAND : mapStyle.land((d as Country).properties.colorIndex);
    },
    [homes, oldHomeCountries, sentFrom, filterId, involved, mapStyle],
  );
  const landAltitude = useCallback(
    (d: object) => {
      // Countries sit a hair above the sea (they'd look like floating slabs when
      // zoomed in), and flatten further the closer you get.
      const key = countryKeyFromFeature(d as Country);
      const base = key && homes.has(key) ? 0.004 : key && (oldHomeCountries?.has(key) || sentFrom.has(key)) ? 0.003 : 0.0022;
      // Tiny places (Vatican, San Marino) can sit inside a bigger country's shape:
      // a hair higher, so they show on top.
      return (base + (isTiny(d) ? 0.0005 : 0)) * lift;
    },
    [homes, oldHomeCountries, sentFrom, lift],
  );
  return (
    <div ref={containerRef} className={`absolute inset-0 ${showNames && zoomedIn ? "globe-labels" : ""}`}>
      {(!ready || !shaped) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-full border border-ink/10 bg-[#fffdf8]/95 px-4 py-2 text-sm text-ink-soft shadow-sm">
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-ink/15 border-t-stamp" />
            Spinning up the globe…
          </div>
        </div>
      )}
      {size && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showGraticules
          atmosphereColor="#e8d6b4"
          atmosphereAltitude={0.14}
          onGlobeReady={() => setReady(true)}
          onZoom={(pov) => {
            setZoomedIn(pov.altitude < 0.75);
            setStrokeScale(Math.min(1, Math.max(0.15, Math.round((pov.altitude / 1.7) * 20) / 20)));
          }}
          onGlobeClick={() => onSelect(null)}
          // Countries
          polygonsData={world}
          polygonCapColor={capColor}
          polygonSideColor={SIDE}
          // Country surfaces follow the globe's curve closely (every 1.5°), so they
          // can sit just above the sea without the sea showing through big countries.
          // Small countries are drawn flat instead, and bigger ones get extra border
          // points, so the colour matches the white border line (see lib/globeShapes).
          polygonGeoJsonGeometry={CAP_GEOMETRY}
          polygonCapCurvatureResolution={capResolution}
          polygonStrokeColor={STROKE}
          // Countries sit a hair above the sea (they'd look like floating slabs when
          // zoomed in), and flatten further the closer you get.
          polygonAltitude={landAltitude}
          polygonsTransitionDuration={0}
          onPolygonClick={() => onSelect(null)}
          // Postcards
          arcsData={showArcs ? arcs : []}
          arcColor={(d: object) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"];
            if (a.lost) return withAlpha(INK, a.role === "other" ? 0.12 : 0.5);
            const alpha = a.role === "other" ? 0.15 : 1;
            // Flag routes: the origin flag's colours blend along the arc.
            const flag = routeColors?.get(a.card.from_country_code.toLowerCase());
            if (flag) return flag.length === 1 ? withAlpha(flag[0], alpha) : flag.map((c) => withAlpha(c, alpha));
            return withAlpha(a.color, alpha);
          }}
          arcStroke={(d) => {
            const a = d as ArcDatum;
            const selected = a.card.id === selectedCardId;
            const base =
              a.kind === "comet"
                ? 0.45
                : selected
                  ? 0.8
                  : a.role === "out" || a.role === "in"
                    ? 0.6
                    : a.role === "other"
                      ? 0.2
                      : 0.35;
            return base * strokeScale;
          }}
          arcAltitudeAutoScale={0.4}
          // Start and end just above the land, so routes don't dip under a country
          arcStartAltitude={0.0045 * lift}
          arcEndAltitude={0.0045 * lift}
          // A small dot where each card landed
          pointsData={showArcs ? landings : []}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude={0.005 * lift}
          pointRadius={Math.max(0.05, 0.32 * strokeScale)}
          pointsMerge={false}
          pointsTransitionDuration={0}
          // Received-by-the-selected-person routes are dotted; in transit stays dashed.
          arcDashLength={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 0.2;
            if (a.role === "in" || a.lost) return 0.012;
            return a.card.status === "in_transit" ? 0.05 : 1;
          }}
          arcDashGap={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 1.4;
            if (a.role === "in" || a.lost) return 0.03;
            return a.card.status === "in_transit" ? 0.035 : 0;
          }}
          arcDashInitialGap={(d) => ((d as ArcDatum).kind === "comet" ? (d as ArcDatum).offset : 0)}
          arcDashAnimateTime={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 3200;
            if (a.role === "in" || a.lost) return 0;
            return a.card.status === "in_transit" ? 5000 : 0;
          }}
          arcsTransitionDuration={600}
          arcLabel={(d) => {
            const a = d as ArcDatum;
            const s = membersById.get(a.card.sender_id)?.display_name ?? "?";
            const r = membersById.get(a.card.recipient_id)?.display_name ?? "?";
            return tooltip(`${escapeHtml(s)} → ${escapeHtml(r)}${a.card.status === "in_transit" ? " · in transit" : a.lost ? " · lost in the post" : ""}`);
          }}
          onArcClick={(d) => onSelect({ kind: "card", id: (d as ArcDatum).card.id })}
          // Pins: HTML markers keep a constant, tappable size at any zoom
          htmlElementsData={points}
          htmlLat="lat"
          htmlLng="lng"
          // On the land like the dots and city names (higher, they drift as the globe turns)
          htmlAltitude={0.0055 * lift}
          htmlElement={makePin}
          htmlElementVisibilityModifier={(el, visible) => {
            // Hide (and make unclickable) pins on the far side of the globe
            el.style.opacity = visible ? (el.dataset.dim ? "0.4" : "1") : "0";
            el.style.pointerEvents = visible ? "auto" : "none";
          }}
          htmlTransitionDuration={0}
          // "Incoming" rings
          ringsData={rings}
          ringColor={(d: object) => {
            const c = (d as { color: string }).color;
            return (t: number) => withAlpha(c, 1 - t);
          }}
          ringMaxRadius={3.5}
          ringPropagationSpeed={1.6}
          ringRepeatPeriod={1400}
        />
      )}

      {ready && (
        <div className="absolute left-3 top-3 z-[5] flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white/90 shadow-sm backdrop-blur">
          {[
            { label: "Zoom in", text: "+", fn: () => zoomBy(0.55) },
            { label: "Zoom out", text: "−", fn: () => zoomBy(1.8) },
            {
              label: "Fit postcards",
              text: "⤢",
              fn: () => {
                const g = globeRef.current;
                if (g) g.controls().autoRotate = false;
                faceCards();
              },
            },
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

/** A pin dot with a name label (labels show via the `globe-labels` class when zoomed in). */
/** Where a lost card went missing: the bird sinking (sea) or puzzled (land). Opens the card. */
function lostPinElement(p: LostDatum, onSelect: (s: Selection) => void): HTMLElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { width: "36px", height: "36px", transition: "opacity 150ms" } satisfies Partial<CSSStyleDeclaration>);
  if (p.dim) wrap.dataset.dim = "1";
  const dot = document.createElement("button");
  dot.type = "button";
  Object.assign(dot.style, {
    display: "block",
    width: "100%",
    height: "100%",
    background: "none",
    border: "0",
    padding: "0",
    cursor: "pointer",
    filter: "drop-shadow(0 1px 1.5px rgba(42,38,34,.35))",
  } satisfies Partial<CSSStyleDeclaration>);
  dot.innerHTML = lostSvg(p.color, p.water);
  dot.title = `Lost ${p.water ? "at sea" : "on the way"}: ${p.card.from_city} → ?`;
  dot.setAttribute("aria-label", dot.title);
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"]) {
    dot.addEventListener(type, (e) => e.stopPropagation());
  }
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect({ kind: "card", id: p.card.id });
  });
  wrap.append(dot);
  return wrap;
}

function pinElement(p: Exclude<PointDatum, LostDatum>, onSelect: (s: Selection) => void): HTMLElement {
  const isHome = p.kind !== "city";
  const dotStyle = isHome && p.style === "dot";
  const size = p.kind === "city" ? 19 : dotStyle ? (p.kind === "home" ? 13 : 10) : p.kind === "home" ? 21 : 17;

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    width: `${size}px`,
    height: `${isHome ? size : 16}px`, // stamps are landscape
    transform: isHome && !dotStyle ? "translateY(-2px)" : "",
    transition: "opacity 150ms",
  } satisfies Partial<CSSStyleDeclaration>);
  if (p.dim) wrap.dataset.dim = "1";

  const dot = document.createElement("button");
  dot.type = "button";
  if (dotStyle) {
    // Classic round dot; an old address is a dashed ring.
    Object.assign(dot.style, {
      display: "block",
      width: "100%",
      height: "100%",
      borderRadius: "9999px",
      background: p.kind === "home" ? p.member.color : "#fffdf7",
      border: p.kind === "home" ? "2.5px solid #fff" : `1.5px dashed ${p.member.color}`,
      boxShadow: p.kind === "home" ? "0 1px 3px rgba(42,38,34,.35)" : "",
      cursor: "pointer",
      padding: "0",
    } satisfies Partial<CSSStyleDeclaration>);
  } else if (isHome) {
    // A little house with their photo or initial; an old address is hollow and dashed.
    Object.assign(dot.style, {
      display: "block",
      width: "100%",
      height: "100%",
      background: "none",
      border: "0",
      cursor: "pointer",
      padding: "0",
      filter: p.kind === "home" ? "drop-shadow(0 1px 1.5px rgba(42,38,34,.4))" : "",
    } satisfies Partial<CSSStyleDeclaration>);
    dot.innerHTML = houseSvg(p.member, p.kind === "old");
  } else {
    // Postage stamp: flag on paper with a perforated edge, same as the flat map.
    Object.assign(dot.style, {
      display: "block",
      width: "100%",
      height: "100%",
      background: "none",
      border: "0",
      cursor: "pointer",
      padding: "0",
      filter: "drop-shadow(0 1px 1.5px rgba(42,38,34,.45))",
    } satisfies Partial<CSSStyleDeclaration>);
    dot.innerHTML = stampSvg(p.city.countryCode, p.city.cards.length);
  }

  const label = document.createElement("span");
  label.className = "globe-pin-label";
  label.textContent =
    p.kind === "home"
      ? `${p.member.display_name} · ${p.member.home_city}`
      : p.kind === "old"
        ? `${p.member.display_name} · ${p.old.city} (before)`
        : p.city.name;
  if (p.kind === "home") label.style.fontWeight = "600";

  if (p.kind === "home") {
    dot.title = `${p.member.display_name} · home in ${p.member.home_city}`;
  } else if (p.kind === "old") {
    const n = p.old.cards;
    dot.title = `${p.member.display_name} · used to live in ${p.old.city} · ${n} ${n === 1 ? "card" : "cards"} sent there`;
  } else {
    const n = p.city.cards.length;
    dot.title = `${p.city.name}, ${p.city.country} · ${n} ${n === 1 ? "card" : "cards"}`;
  }
  dot.setAttribute("aria-label", dot.title);

  // The globe treats any pointer press+release as a "click on the globe" (which
  // deselects), so keep pin presses from reaching it.
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"]) {
    dot.addEventListener(type, (e) => e.stopPropagation());
  }
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(p.kind === "city" ? { kind: "city", key: p.city.key } : { kind: "member", id: p.member.id });
  });

  wrap.append(dot, label);
  return wrap;
}

/** Same stamp as the flat map's StampPin, as markup for an HTML marker. */
function stampSvg(countryCode: string, count: number): string {
  const cc = countryCode.toLowerCase().replace(/[^a-z]/g, "");
  const badge =
    count > 1
      ? `<g transform="translate(19.5,3.5)"><circle r="4.8" fill="#c2503a" stroke="#fff" stroke-width="1"/><text y="2.3" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="system-ui">${count}</text></g>`
      : "";
  return `<svg viewBox="-1 -1 25 21" width="100%" height="100%" overflow="visible" aria-hidden="true">
    <rect x="1" y="1" width="21" height="17" fill="#fffdf7" stroke="#fffdf7" stroke-width="2.4" stroke-dasharray="0.01 2.7" stroke-linecap="round"/>
    <image href="https://flagcdn.com/w40/${cc}.png" x="3" y="3" width="17" height="13" preserveAspectRatio="none"/>
    <rect x="3" y="3" width="17" height="13" fill="none" stroke="#2a2622" stroke-opacity=".2" stroke-width=".6"/>
    ${badge}
  </svg>`;
}

function tooltip(html: string) {
  return `<div style="background:rgba(42,38,34,.88);color:#f6f0e4;padding:4px 8px;border-radius:8px;font:500 12px/1.4 system-ui,sans-serif">${html}</div>`;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}

/** Average position of lat/lng points on the sphere (handles the date line). */
function centroid(points: number[][]): { lat: number; lng: number } {
  let x = 0, y = 0, z = 0;
  for (const [lat, lng] of points) {
    const φ = (lat * Math.PI) / 180;
    const λ = (lng * Math.PI) / 180;
    x += Math.cos(φ) * Math.cos(λ);
    y += Math.cos(φ) * Math.sin(λ);
    z += Math.sin(φ);
  }
  const lng = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.hypot(x, y));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}
