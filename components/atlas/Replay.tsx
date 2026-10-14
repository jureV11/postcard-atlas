"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapCard } from "@/lib/atlas";
import { formatDate, todayLocal } from "@/lib/dates";
import { isLocated } from "@/lib/types";

const DAY_MS = 86_400_000;
const TICK_MS = 70; // one day per tick → a full year in ~25 seconds

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Replays the arrived postcards day by day. Only received cards take part — their
 * origins are public now, so showing them "in flight" in the past spoils nothing.
 */
export function useReplay(cards: MapCard[]) {
  const history = useMemo(() => cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated), [cards]);
  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const c of history) {
      ys.add(Number(c.sent_on.slice(0, 4)));
      if (c.received_on) ys.add(Number(c.received_on.slice(0, 4)));
    }
    return [...ys].sort((a, b) => b - a);
  }, [history]);

  const [active, setActive] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);

  const selectedYear = year ?? years[0] ?? new Date().getFullYear();
  const start = `${selectedYear}-01-01`;
  const today = todayLocal();
  const yearEnd = `${selectedYear}-12-31`;
  const end = yearEnd < today ? yearEnd : today;
  const totalDays = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS));
  const date = addDays(start, Math.min(day, totalDays));

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setDay((d) => {
        if (d >= totalDays) {
          setPlaying(false);
          return d;
        }
        return d + 1;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [playing, totalDays]);

  // The cards as they stood on `date`: posted ones in flight, delivered ones landed.
  const replayCards = useMemo<MapCard[]>(
    () =>
      history
        .filter((c) => c.sent_on <= date)
        .map((c) =>
          c.received_on && c.received_on <= date ? c : { ...c, status: "in_transit" as const, received_on: null },
        ),
    [history, date],
  );

  return {
    available: years.length > 0,
    active,
    years,
    year: selectedYear,
    day: Math.min(day, totalDays),
    totalDays,
    date,
    playing,
    replayCards,
    start() {
      setActive(true);
      setDay(0);
      setPlaying(true);
    },
    stop() {
      setActive(false);
      setPlaying(false);
    },
    togglePlay() {
      if (day >= totalDays) setDay(0); // finished → play from the start again
      setPlaying((p) => !p);
    },
    seek(d: number) {
      setDay(d);
      setPlaying(false);
    },
    chooseYear(y: number) {
      setYear(y);
      setDay(0);
      setPlaying(true);
    },
  };
}

export type ReplayState = ReturnType<typeof useReplay>;

/** Big date stamped across the top of the map while replaying. */
export function ReplayDate({ date }: { date: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[5] -translate-x-1/2 rounded-full border border-ink/10 bg-white/90 px-4 py-1.5 font-display text-lg font-semibold tabular-nums shadow-sm backdrop-blur sm:text-xl">
      {formatDate(date)}
    </div>
  );
}

export function ReplayBar({ replay, postcards, countries }: { replay: ReplayState; postcards: number; countries: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2.5 shadow-sm">
      <button
        type="button"
        onClick={replay.togglePlay}
        aria-label={replay.playing ? "Pause" : "Play"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper"
      >
        {replay.playing ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden="true">
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </button>

      {replay.years.length > 1 ? (
        <select
          aria-label="Year"
          value={replay.year}
          onChange={(e) => replay.chooseYear(Number(e.target.value))}
          className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium"
        >
          {replay.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm font-medium">{replay.year}</span>
      )}

      <input
        type="range"
        min={0}
        max={replay.totalDays}
        value={replay.day}
        onChange={(e) => replay.seek(Number(e.target.value))}
        aria-label="Day of the year"
        className="min-w-40 flex-1 accent-[var(--color-stamp)]"
      />

      <span className="text-xs text-ink-soft tabular-nums">
        <strong className="text-ink">{postcards}</strong> {postcards === 1 ? "postcard" : "postcards"} ·{" "}
        <strong className="text-ink">{countries}</strong> {countries === 1 ? "country" : "countries"}
      </span>

      <button type="button" onClick={replay.stop} className="btn-ghost min-h-9 px-4">
        Done
      </button>
    </div>
  );
}
