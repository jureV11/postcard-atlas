"use client";

// Loaded with next/dynamic (ssr: false) — three.js needs `window`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import type { CityGroup, LocatedMapCard, OldHome, RouteRole, Selection } from "@/lib/atlas";
import { countryKeyFromFeature } from "@/lib/countries";
import { PLAIN, type MapStyle } from "@/lib/mapStyle";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";
import { loadWorld, type Country } from "@/lib/world";
import { houseSvg } from "./house";

const OCEAN = "#dde6e8";
const LAND = "#e9e0cd";
const SENT_FROM = "#e9c48c";
const INK = "#2a2622";

type ArcDatum = {
  kind: "line" | "comet";
  role: RouteRole | null; // with a person selected: "out" solid, "in" dotted, "other" faded
  card: LocatedMapCard;
  color: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  offset: number;
};

type PointDatum =
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
}: {
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

  useEffect(() => {
    loadWorld().then(setWorld);
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
        const base = {
          card,
          role,
          color: membersById.get(card.sender_id)?.color ?? INK,
          startLat: card.from_lat,
          startLng: card.from_lng,
          endLat: destinationOf(card, r)!.lat, // the address it was sent to
          endLng: destinationOf(card, r)!.lng,
        };
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
    ],
    [cities, members, oldHomes, filterId, involved, focusCities, homeStyle],
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
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const stop = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [ready]);

  // Face the postcards: on load and whenever the filter changes.
  useEffect(() => {
    const g = globeRef.current;
    if (!ready || !g) return;
    const pts = [
      ...cities.filter((c) => !filterId || !focusCities || focusCities.has(c.key)).map((c) => [c.lat, c.lng]),
      ...members.filter((m) => !filterId || involved.has(m.id)).map((m) => [m.home_lat, m.home_lng]),
    ];
    if (!pts.length) return;
    g.pointOfView({ ...centroid(pts), altitude: pts.length > 1 ? 1.7 : 1.4 }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filterId]);

  // Stable so the globe doesn't rebuild every pin on each render.
  const makePin = useCallback((d: object) => pinElement(d as PointDatum, onSelect), [onSelect]);

  const selectedCardId = selection?.kind === "card" ? selection.id : null;

  return (
    <div ref={containerRef} className={`absolute inset-0 ${zoomedIn ? "globe-labels" : ""}`}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">Spinning up the globe…</div>
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
          onZoom={(pov) => setZoomedIn(pov.altitude < 0.75)}
          onGlobeClick={() => onSelect(null)}
          // Countries
          polygonsData={world}
          polygonCapColor={(d) => {
            const key = countryKeyFromFeature(d as Country);
            const home = key ? homes.get(key) : undefined;
            if (home) return withAlpha(home.color, filterId && !involved.has(home.id) ? 0.35 : 0.85);
            // An old address's country: a lighter wash of their colour (the flat map stripes it).
            const old = key ? oldHomeCountries?.get(key) : undefined;
            if (old) return withAlpha(old.color, filterId && !involved.has(old.id) ? 0.15 : 0.38);
            if (key && sentFrom.has(key)) return mapStyle === PLAIN ? SENT_FROM : mapStyle.sentFrom;
            return mapStyle === PLAIN ? LAND : mapStyle.land((d as Country).properties.colorIndex);
          }}
          polygonSideColor={() => "rgba(42,38,34,0.08)"}
          polygonStrokeColor={() => "rgba(255,255,255,0.7)"}
          polygonAltitude={(d) => {
            const key = countryKeyFromFeature(d as Country);
            if (key && homes.has(key)) return 0.012;
            if (key && oldHomeCountries?.has(key)) return 0.009;
            return key && sentFrom.has(key) ? 0.009 : 0.005;
          }}
          polygonsTransitionDuration={400}
          onPolygonClick={() => onSelect(null)}
          // Postcards
          arcsData={showArcs ? arcs : []}
          arcColor={(d: object) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"];
            const alpha = a.role === "other" ? 0.15 : 1;
            // Flag routes: the origin flag's colours blend along the arc.
            const flag = routeColors?.get(a.card.from_country_code.toLowerCase());
            if (flag) return flag.length === 1 ? withAlpha(flag[0], alpha) : flag.map((c) => withAlpha(c, alpha));
            return withAlpha(a.color, alpha);
          }}
          arcStroke={(d) => {
            const a = d as ArcDatum;
            const selected = a.card.id === selectedCardId;
            if (a.kind === "comet") return 0.7;
            if (selected) return 1.2;
            return a.role === "out" || a.role === "in" ? 0.9 : a.role === "other" ? 0.35 : 0.55;
          }}
          arcAltitudeAutoScale={0.4}
          // Received-by-the-selected-person routes are dotted; in transit stays dashed.
          arcDashLength={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 0.2;
            if (a.role === "in") return 0.012;
            return a.card.status === "in_transit" ? 0.05 : 1;
          }}
          arcDashGap={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 1.4;
            if (a.role === "in") return 0.018;
            return a.card.status === "in_transit" ? 0.035 : 0;
          }}
          arcDashInitialGap={(d) => ((d as ArcDatum).kind === "comet" ? (d as ArcDatum).offset : 0)}
          arcDashAnimateTime={(d) => {
            const a = d as ArcDatum;
            if (a.kind === "comet") return 3200;
            if (a.role === "in") return 0;
            return a.card.status === "in_transit" ? 5000 : 0;
          }}
          arcsTransitionDuration={600}
          arcLabel={(d) => {
            const a = d as ArcDatum;
            const s = membersById.get(a.card.sender_id)?.display_name ?? "?";
            const r = membersById.get(a.card.recipient_id)?.display_name ?? "?";
            return tooltip(`${escapeHtml(s)} → ${escapeHtml(r)}${a.card.status === "in_transit" ? " · in transit" : ""}`);
          }}
          onArcClick={(d) => onSelect({ kind: "card", id: (d as ArcDatum).card.id })}
          // Pins: HTML markers keep a constant, tappable size at any zoom
          htmlElementsData={points}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={(d) => ((d as PointDatum).kind === "city" ? 0.01 : 0.015)}
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
    </div>
  );
}

/** A pin dot with a name label (labels show via the `globe-labels` class when zoomed in). */
function pinElement(p: PointDatum, onSelect: (s: Selection) => void): HTMLElement {
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
