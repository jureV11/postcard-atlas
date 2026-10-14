"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { FlatMap } from "@/components/atlas/FlatMap";
import { MemberFilter } from "@/components/atlas/MemberFilter";
import { ReplayBar, ReplayDate, useReplay } from "@/components/atlas/Replay";
import { deriveAtlas, type MapCard, type Selection } from "@/lib/atlas";
import { COLOURFUL, PLAIN } from "@/lib/mapStyle";
import type { MemberWithAvatar } from "@/lib/types";

// three.js is big and browser-only — load it only when someone opens the globe.
const GlobeView = dynamic(() => import("@/components/atlas/GlobeView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">Spinning up the globe…</div>
  ),
});

type View = "flat" | "globe";
// v2: the globe became the default, so earlier saved choices start fresh.
const VIEW_KEY = "atlas-view-v2";
const ROUTES_KEY = "atlas-routes";
const COLOUR_KEY = "atlas-colour";

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function Atlas({ cards, members }: { cards: MapCard[]; members: MemberWithAvatar[] }) {
  const [view, setView] = useState<View | null>(null); // null until the saved choice is read
  const [showRoutes, setShowRoutes] = useState(false);
  const [colourful, setColourful] = useState(true);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Remember view, routes and colour per device.
  useEffect(() => {
    setView(readPref(VIEW_KEY) === "flat" ? "flat" : "globe");
    setShowRoutes(readPref(ROUTES_KEY) === "1");
    setColourful(readPref(COLOUR_KEY) !== "0");
  }, []);
  function changeView(v: View) {
    setView(v);
    savePref(VIEW_KEY, v);
  }
  function toggleRoutes() {
    const next = !showRoutes;
    setShowRoutes(next);
    savePref(ROUTES_KEY, next ? "1" : "0");
    if (!next && selection?.kind === "card") setSelection(null); // its route just disappeared
  }
  function toggleColour() {
    const next = !colourful;
    setColourful(next);
    savePref(COLOUR_KEY, next ? "1" : "0");
  }

  const replay = useReplay(cards);
  const shownCards = replay.active ? replay.replayCards : cards;

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const atlas = useMemo(() => deriveAtlas(shownCards, members, filterId), [shownCards, members, filterId]);

  const layerProps = {
    cards: atlas.located,
    cities: atlas.cities,
    sentFrom: atlas.sentFrom,
    homes: atlas.homes,
    // Pulsing "on its way" rings only in the replay (history) — never live, no spoilers.
    awaiting: replay.active ? atlas.awaiting : undefined,
    members,
    membersById,
    filterId,
    roles: atlas.roles,
    involvedMembers: atlas.involvedMembers,
    focusCities: atlas.focusCities,
    selection,
    onSelect: setSelection,
    // Routes show when ticked, during the replay, and whenever a person is selected.
    showArcs: showRoutes || replay.active || filterId !== null,
    mapStyle: colourful ? COLOURFUL : PLAIN,
  };

  return (
    <div className="space-y-3">
      <MemberFilter
        members={members}
        value={filterId}
        onChange={(id) => {
          setFilterId(id);
          setSelection(null);
        }}
      />

      <div
        className={`relative -mx-4 aspect-square max-h-[72vh] overflow-hidden border-y border-ink/10 shadow-sm sm:mx-0 sm:aspect-auto sm:h-[620px] sm:max-h-none sm:rounded-2xl sm:border lg:h-[calc(100dvh-13rem)] lg:min-h-[560px] ${
          view === "globe" ? "bg-[radial-gradient(circle_at_50%_45%,#f8f3ea_0%,#ece3d2_70%)]" : "bg-[#f3ede1]"
        }`}
      >
        {view === "flat" && <FlatMap {...layerProps} />}
        {view === "globe" && <GlobeView {...layerProps} />}

        {view && (
          <div className="absolute right-3 top-3 z-[5] flex flex-col items-end gap-1.5 sm:flex-row">
            {replay.available && !replay.active && (
              <button
                type="button"
                onClick={() => {
                  setSelection(null);
                  replay.start();
                }}
                title="Replay the year's postcards"
                className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/90 py-1.5 pl-2.5 pr-3 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white"
              >
                <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M7 5v14l12-7z" />
                </svg>
                Replay
              </button>
            )}
            {!replay.active && (
              <Toggle checked={showRoutes} onChange={toggleRoutes} label="Routes" hint="Show where postcards flew from" />
            )}
            <Toggle checked={colourful} onChange={toggleColour} label="Colour" hint="Colourful atlas style" />
          </div>
        )}
        {replay.active && <ReplayDate date={replay.date} />}

        <div className="absolute bottom-3 left-3 z-[5] flex rounded-full border border-ink/10 bg-white/90 p-0.5 text-sm font-medium shadow-sm backdrop-blur">
          {(["globe", "flat"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-3.5 py-1.5 transition ${view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
            >
              {v === "flat" ? "Map" : "Globe"}
            </button>
          ))}
        </div>

        {selection && (
          <AtlasPanel
            selection={selection}
            onSelect={setSelection}
            onClose={() => setSelection(null)}
            cards={atlas.located}
            cities={atlas.cities}
            membersById={membersById}
          />
        )}
      </div>

      {replay.active && (
        <ReplayBar
          replay={replay}
          postcards={atlas.visibleCards.filter((c) => c.status === "received").length}
          countries={atlas.countryCount}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
        <span className="font-medium text-ink">
          {atlas.countryCount} {atlas.countryCount === 1 ? "country" : "countries"}
          {filterId ? ` · ${membersById.get(filterId)?.display_name}` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="12" aria-hidden="true">
            <defs>
              <pattern id="legend-hatch" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="3" stroke="#2a2622" strokeOpacity="0.35" strokeWidth="0.9" />
              </pattern>
            </defs>
            <rect width="16" height="12" rx="2" fill="#efd5ab" />
            {view === "flat" && <rect width="16" height="12" rx="2" fill="url(#legend-hatch)" />}
          </svg>
          Sent from
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1">
            {members.slice(0, 4).map((m) => (
              <span key={m.id} className="size-3 rounded-full ring-1 ring-white" style={{ background: m.color }} />
            ))}
          </span>
          Home countries
        </span>
        {filterId && (
          <>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="8" aria-hidden="true">
                <line x1="2" y1="4" x2="22" y2="4" stroke={membersById.get(filterId)?.color} strokeWidth="3" strokeLinecap="round" />
              </svg>
              Sent by {membersById.get(filterId)?.display_name}
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="8" aria-hidden="true">
                <line x1="2" y1="4" x2="22" y2="4" stroke="#2a2622" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 5" />
              </svg>
              Received by {membersById.get(filterId)?.display_name}
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterId(null);
                setSelection(null);
              }}
              className="font-medium text-stamp hover:underline"
            >
              Show all
            </button>
          </>
        )}
        {replay.active && (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="3" fill="#2a2622" />
              <circle cx="7" cy="7" r="6" fill="none" stroke="#2a2622" strokeOpacity="0.4" />
            </svg>
            Pulsing = a postcard was on its way
          </span>
        )}
        {!filterId && (
          <span className="hidden sm:inline">
            {replay.active
              ? "Dashed = in the post · solid = delivered"
              : showRoutes
                ? "Click a route to open its postcard"
                : "Tick Routes, or pick a person above, to see routes"}{" "}
            · zoom in for city names
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      title={hint}
      className={`flex cursor-pointer select-none items-center gap-2 rounded-full border py-1.5 pl-2 pr-3 text-sm font-medium shadow-sm backdrop-blur transition ${
        checked ? "border-ink bg-ink text-paper" : "border-ink/10 bg-white/90 text-ink hover:bg-white"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-4 items-center justify-center rounded border text-[11px] leading-none peer-focus-visible:ring-2 peer-focus-visible:ring-stamp ${
          checked ? "border-paper bg-paper text-ink" : "border-ink/30 bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </label>
  );
}
