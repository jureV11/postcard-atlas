"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapCard } from "@/lib/atlas";
import { formatDate } from "@/lib/dates";
import { isLocated } from "@/lib/types";

const DAY_MS = 86_400_000;
const SEND_TICK = "#c2503a"; // stamp red
const ARRIVE_TICK = "#1b998b"; // teal

/** Playback speeds, in timeline days per real second. */
export const SPEEDS = [
  { label: "1 day/sec", daysPerSec: 1 },
  { label: "1 week/sec", daysPerSec: 7 },
  { label: "1 month/sec", daysPerSec: 30 },
] as const;

const dayOf = (iso: string, start: number) => Math.round((Date.parse(iso) - start) / DAY_MS);
const isoOf = (start: number, day: number) => new Date(start + Math.floor(day) * DAY_MS).toISOString().slice(0, 10);

/**
 * Replays every delivered postcard on one continuous timeline, from the first
 * card ever posted to the last arrival, in real travel time: each route appears
 * on its sent date and grows along its path until its received date.
 * Only public (revealed) cards take part, so nothing spoils a surprise.
 */
export function useReplay(cards: MapCard[]) {
  const history = useMemo(
    () => cards.filter((c) => c.status === "received" && c.is_public && c.received_on).filter(isLocated),
    [cards],
  );

  const span = useMemo(() => {
    if (!history.length) return null;
    const start = Math.min(...history.map((c) => Date.parse(c.sent_on)));
    const end = Math.max(...history.map((c) => Date.parse(c.received_on!)));
    return { start, totalDays: Math.max(1, Math.round((end - start) / DAY_MS)) };
  }, [history]);

  const [active, setActive] = useState(false);
  const [day, setDay] = useState(0); // fractional days since the first send
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // 1 week/sec
  const totalDays = span?.totalDays ?? 1;

  // Smooth playback: advance by real elapsed time, ~25 updates a second.
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    const perSec = SPEEDS[speedIdx].daysPerSec;
    let raf = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (last.current === null) last.current = now;
      const dt = (now - last.current) / 1000;
      if (now - lastPaint > 40) {
        last.current = now;
        lastPaint = now;
        setDay((d) => {
          const next = d + dt * perSec;
          if (next >= totalDays) {
            setPlaying(false);
            return totalDays;
          }
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedIdx, totalDays]);

  // Cards as they stood at this moment, and how far along its route each one is.
  const { replayCards, progress } = useMemo(() => {
    const progress = new Map<string, number>();
    const replayCards: MapCard[] = [];
    if (!span) return { replayCards, progress };
    for (const c of history) {
      const sent = dayOf(c.sent_on, span.start);
      if (day < sent) continue;
      const arrived = dayOf(c.received_on!, span.start);
      // Same-day delivery counts as a one-day journey.
      const p = arrived <= sent ? (day >= sent + 1 ? 1 : day - sent) : Math.min(1, (day - sent) / (arrived - sent));
      progress.set(c.id, p);
      replayCards.push(p >= 1 ? c : { ...c, status: "in_transit", received_on: null });
    }
    return { replayCards, progress };
  }, [history, span, day]);

  const markers = useMemo(() => {
    if (!span) return { sends: [], arrivals: [], years: [] as { year: number; at: number }[] };
    const pct = (iso: string) => (dayOf(iso, span.start) / totalDays) * 100;
    const years: { year: number; at: number }[] = [];
    const first = new Date(span.start).getUTCFullYear();
    const last = new Date(span.start + totalDays * DAY_MS).getUTCFullYear();
    for (let y = first; y <= last; y++) {
      const at = Math.max(0, ((Date.UTC(y, 0, 1) - span.start) / DAY_MS / totalDays) * 100);
      if (at <= 100) years.push({ year: y, at });
    }
    return {
      sends: history.map((c) => pct(c.sent_on)),
      arrivals: history.map((c) => pct(c.received_on!)),
      years,
    };
  }, [history, span, totalDays]);

  return {
    available: history.length > 0,
    active,
    day,
    totalDays,
    date: span ? isoOf(span.start, day) : "",
    playing,
    speedIdx,
    replayCards,
    progress,
    markers,
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
    },
    setSpeed(i: number) {
      setSpeedIdx(i);
    },
  };
}

export type ReplayState = ReturnType<typeof useReplay>;

/** Big date stamped across the top of the map while replaying. */
export function ReplayDate({ date }: { date: string }) {
  if (!date) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[5] -translate-x-1/2 rounded-full border border-ink/10 bg-white/90 px-4 py-1.5 font-display text-lg font-semibold tabular-nums shadow-sm backdrop-blur sm:text-xl">
      {formatDate(date)}
    </div>
  );
}

export function ReplayBar({ replay, postcards, countries }: { replay: ReplayState; postcards: number; countries: number }) {
  const { markers } = replay;
  return (
    <div className="space-y-2 rounded-2xl border border-ink/10 bg-white/80 px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex rounded-full border border-ink/10 bg-white p-0.5 text-xs font-medium" role="group" aria-label="Speed">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => replay.setSpeed(i)}
              aria-pressed={replay.speedIdx === i}
              className={`rounded-full px-2.5 py-1 transition ${
                replay.speedIdx === i ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-ink-soft tabular-nums">
          <strong className="text-ink">{postcards}</strong> {postcards === 1 ? "postcard" : "postcards"} delivered ·{" "}
          <strong className="text-ink">{countries}</strong> {countries === 1 ? "country" : "countries"}
        </span>

        <button type="button" onClick={replay.stop} className="btn-ghost min-h-9 px-4">
          Done
        </button>
      </div>

      {/* Timeline: ticks above the slider, year labels below */}
      <div className="relative px-1 pt-3 pb-5">
        <div className="pointer-events-none absolute inset-x-1 top-0 h-3" aria-hidden="true">
          {markers.sends.map((at, i) => (
            <span key={`s${i}`} className="absolute top-0 h-2 w-0.5 rounded-full" style={{ left: `${at}%`, background: SEND_TICK }} />
          ))}
          {markers.arrivals.map((at, i) => (
            <span key={`a${i}`} className="absolute top-1 h-2 w-0.5 rounded-full" style={{ left: `${at}%`, background: ARRIVE_TICK }} />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={replay.totalDays}
          step={1}
          value={Math.floor(replay.day)}
          onChange={(e) => replay.seek(Number(e.target.value))}
          aria-label="Timeline"
          className="block w-full accent-[var(--color-stamp)]"
        />
        <div className="pointer-events-none absolute inset-x-1 bottom-0 h-4 text-[10px] text-ink-soft" aria-hidden="true">
          {markers.years.map((y) => (
            <span key={y.year} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${y.at}%` }}>
              {y.year}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-0.5 rounded-full" style={{ background: SEND_TICK }} /> Posted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-0.5 rounded-full" style={{ background: ARRIVE_TICK }} /> Arrived
        </span>
      </div>
    </div>
  );
}
