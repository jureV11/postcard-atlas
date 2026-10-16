"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AtlasPanel } from "@/components/atlas/AtlasPanel";
import { FlatMap } from "@/components/atlas/FlatMap";
import { MemberFilter } from "@/components/atlas/MemberFilter";
import { ReplayBar, ReplayDate, useReplay } from "@/components/atlas/Replay";
import { deriveAtlas, type MapCard, type Selection } from "@/lib/atlas";
import { useFlagColors } from "@/lib/flagColors";
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
const FLAG_ROUTES_KEY = "atlas-flag-routes";
const HOUSES_KEY = "atlas-houses";

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
  const [flagRoutes, setFlagRoutes] = useState(true); // routes in the origin flag's colours
  const [houses, setHouses] = useState(true); // home markers as houses (or classic dots)
  const [filterId, setFilterId] = useState<string | null>(null);
  // With a person selected: show the cards they sent, received, or both.
  const [directions, setDirections] = useState({ sent: true, received: true });
  const [selection, setSelection] = useState<Selection | null>(null);

  // Remember view, routes and colour per device.
  useEffect(() => {
    setView(readPref(VIEW_KEY) === "flat" ? "flat" : "globe");
    setShowRoutes(readPref(ROUTES_KEY) === "1");
    setColourful(readPref(COLOUR_KEY) !== "0");
    setFlagRoutes(readPref(FLAG_ROUTES_KEY) !== "0");
    setHouses(readPref(HOUSES_KEY) !== "0");
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
  function toggleHouses() {
    const next = !houses;
    setHouses(next);
    savePref(HOUSES_KEY, next ? "1" : "0");
  }
  function toggleFlagRoutes() {
    const next = !flagRoutes;
    setFlagRoutes(next);
    savePref(FLAG_ROUTES_KEY, next ? "1" : "0");
  }
  function toggleColour() {
    const next = !colourful;
    setColourful(next);
    savePref(COLOUR_KEY, next ? "1" : "0");
  }

  const replay = useReplay(cards);
  const shownCards = replay.active ? replay.replayCards : cards;

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const atlas = useMemo(
    () => deriveAtlas(shownCards, members, filterId, directions),
    [shownCards, members, filterId, directions],
  );

  function selectPerson(id: string | null) {
    setFilterId(id);
    setDirections({ sent: true, received: true }); // each new person starts with both
    setSelection(null);
  }
  function toggleDirection(which: "sent" | "received") {
    setDirections((d) => {
      const next = { ...d, [which]: !d[which] };
      // Never both off — unticking the last one switches to the other instead.
      return next.sent || next.received ? next : { sent: which === "received", received: which === "sent" };
    });
    setSelection(null);
  }
  const person = filterId ? membersById.get(filterId) : undefined;
  const routeColors = useFlagColors(
    atlas.located.map((c) => c.from_country_code),
    flagRoutes,
  );

  const layerProps = {
    cards: atlas.located,
    cities: atlas.cities,
    sentFrom: atlas.sentFrom,
    homes: atlas.homes,
    oldHomes: atlas.oldHomes,
    oldHomeCountries: atlas.oldHomeCountries,
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
    routeColors: flagRoutes ? routeColors : undefined,
    homeStyle: houses ? ("house" as const) : ("dot" as const),
    // Replay: how far along its route each card is, so routes grow in real travel time.
    progress: replay.active ? replay.progress : undefined,
  };

  // The replay runs on the flat map (routes grow far more smoothly there);
  // Done puts back whichever view you had.
  const [viewBeforeReplay, setViewBeforeReplay] = useState<View | null>(null);
  function startReplay() {
    setSelection(null);
    setViewBeforeReplay(view);
    setView("flat"); // not saved as your preference
    replay.start();
  }
  function stopReplay() {
    replay.stop();
    if (viewBeforeReplay) setView(viewBeforeReplay);
    setViewBeforeReplay(null);
  }
  const replayBar = { ...replay, stop: stopReplay };

  return (
    <div className="space-y-3">
      <MemberFilter members={members} value={filterId} onChange={selectPerson} />

      {person && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Show:</span>
          <DirectionToggle
            checked={directions.sent}
            onChange={() => toggleDirection("sent")}
            label={`Sent by ${person.display_name}`}
            count={atlas.sentCount}
            sample={<line x1="2" y1="4" x2="22" y2="4" stroke={person.color} strokeWidth="3" strokeLinecap="round" />}
          />
          <DirectionToggle
            checked={directions.received}
            onChange={() => toggleDirection("received")}
            label={`Received by ${person.display_name}`}
            count={atlas.receivedCount}
            sample={
              <line x1="2" y1="4" x2="22" y2="4" stroke="#2a2622" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 5" />
            }
          />
          <button type="button" onClick={() => selectPerson(null)} className="ml-1 font-medium text-stamp hover:underline">
            Show all
          </button>
        </div>
      )}

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
                onClick={startReplay}
                title="Replay every postcard's journey, in real travel time"
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
            {(showRoutes || replay.active || filterId !== null) && (
              <Toggle
                checked={flagRoutes}
                onChange={toggleFlagRoutes}
                label="Flags"
                hint="Colour each route like the flag of the country it was sent from"
              />
            )}
            <Toggle
              checked={houses}
              onChange={toggleHouses}
              label="Houses"
              hint="Show homes as little houses with photos, or as plain dots"
            />
            <Toggle checked={colourful} onChange={toggleColour} label="Colour" hint="Colourful atlas style" />
          </div>
        )}
        {replay.active && <ReplayDate date={replay.date} />}

        <div
          className={`absolute bottom-3 left-3 z-[5] flex rounded-full border border-ink/10 bg-white/90 p-0.5 text-sm font-medium shadow-sm backdrop-blur ${
            replay.active ? "hidden" : ""
          }`}
        >
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
          replay={replayBar}
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
        {atlas.oldHomes.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-4 rounded-sm border border-ink/25"
              style={{
                background:
                  view === "flat"
                    ? "repeating-linear-gradient(45deg, #2a262299 0 1.5px, transparent 1.5px 4px)"
                    : "#2a262233",
              }}
            />
            Old addresses
          </span>
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

/** "✓ Sent by Ana (3)" — picks which of the selected person's routes are highlighted. */
function DirectionToggle({
  checked,
  onChange,
  label,
  count,
  sample,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  sample: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-2 rounded-full border py-1 pl-2 pr-3 transition ${
        checked ? "border-ink/30 bg-white text-ink" : "border-ink/10 bg-white/50 text-ink-soft"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-4 items-center justify-center rounded border text-[11px] leading-none peer-focus-visible:ring-2 peer-focus-visible:ring-stamp ${
          checked ? "border-ink bg-ink text-paper" : "border-ink/30 bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <svg width="24" height="8" aria-hidden="true" className={checked ? "" : "opacity-40"}>
        {sample}
      </svg>
      {label}
      <span className="tabular-nums text-ink-soft">({count})</span>
    </label>
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
