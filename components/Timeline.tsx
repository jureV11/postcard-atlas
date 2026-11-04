"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { TimelineMap } from "@/components/TimelineMap";
import type { MeetupStop, MemberWithAvatar } from "@/lib/types";

export type TimelineEntry = {
  id: string;
  title: string;
  dates: string;
  startsOn: string;
  places: MeetupStop[]; // in the order we went: one city, or a trip through several
  photoUrl: string | null;
  photoFocus: string; // which part of the main photo to keep in view (CSS object-position)
  members: MemberWithAvatar[];
};

/** "Lisbon", or a trip: "Beijing → Xi'an → Shanghai". */
const placesLabel = (places: MeetupStop[]) => places.map((p) => p.name).join(" → ");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_PX = 72; // every month is the same width, so the line is to scale
const EDGE = 130; // room before the first month and after the last, for a card on the edge
const CARD_W = 208;
const LANE = 290; // a card plus a gap, if cards ever have to stack outward (more once a long title is measured)
const GAP = 44; // line to the nearest card
const MAX_SHIFT = CARD_W * 2; // how far a card may slide sideways from its date before it stacks outward instead
const SPACING = 16; // between cards side by side

/**
 * Meetups on a line from past to future. From `sm` up it's to scale (a month is
 * always the same width) and scrolls sideways, photos sticking out above and
 * below at their month. On phones it's a list down a vertical line, newest first.
 * Then a map of everywhere we met up.
 */
export function Timeline({ entries, today }: { entries: TimelineEntry[]; today: string }) {
  return (
    <>
      {entries.length > 1 && <TimelineSearch entries={entries} />}
      <div className="sm:hidden">
        <VerticalTimeline entries={entries} today={today} />
      </div>
      <div className="hidden sm:block">
        <ScaledTimeline entries={entries} today={today} />
      </div>
      <TimelineMap
        places={entries.flatMap((e) =>
          e.places.map((p, step) => ({ id: e.id, title: e.title, dates: e.dates, city: p.name, lat: p.lat, lng: p.lng, step })),
        )}
      />
    </>
  );
}

/** Find a meetup by name, place, year or who was there. */
function TimelineSearch({ entries }: { entries: TimelineEntry[] }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? entries
        .filter((e) => {
          const text = [
            e.title,
            ...e.places.flatMap((p) => [p.name, p.country]),
            e.dates,
            e.startsOn.slice(0, 4),
            ...e.members.map((m) => m.display_name),
          ]
            .join(" ")
            .toLowerCase();
          return words.every((w) => text.includes(w));
        })
        .reverse() // newest first
    : [];

  return (
    <div className="relative mb-4 max-w-md">
      <input
        type="search"
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trips: Venice, 2023, a name…"
        aria-label="Search the timeline"
      />
      {words.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-[8px] border border-ink/10 bg-[#fffdf8] p-1.5 shadow-[0_12px_32px_-12px_rgb(42_38_34/0.45)]">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No trips match that.</li>}
          {matches.map((e) => (
            <li key={e.id}>
              <Link href={`/timeline/${e.id}`} className="flex items-center gap-3 rounded-[6px] px-2 py-1.5 hover:bg-paper-deep/60">
                <span className="size-10 shrink-0 overflow-hidden rounded-[3px] bg-paper-deep">
                  {e.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photoUrl} alt="" className="size-full object-cover" style={{ objectPosition: e.photoFocus }} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-medium break-words">{e.title}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-ink-soft">
                    {e.places[0] && <Flag code={e.places[0].countryCode} size={12} />}
                    {[placesLabel(e.places), e.dates].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const yearOf = (date: string) => Number(date.slice(0, 4));

function ScaledTimeline({ entries, today }: { entries: TimelineEntry[]; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const [lane, setLane] = useState(LANE);

  const firstYear = Math.min(yearOf(today), ...entries.map((e) => yearOf(e.startsOn)));
  const lastYear = Math.max(yearOf(today), ...entries.map((e) => yearOf(e.startsOn)));
  const months = (lastYear - firstYear + 1) * 12;
  const x = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return EDGE + ((y - firstYear) * 12 + (m - 1) + (d - 1) / daysInMonth) * MONTH_PX;
  };

  // Above and below the line, side by side: a card that would overlap the one
  // before it slides along (its stalk bends to reach it) rather than stacking
  // outward, which leaves big empty gaps. Only if it would have to slide too far
  // does it go out a lane.
  type Side = "up" | "down";
  const ends: Record<Side, number[]> = { up: [], down: [] }; // right edge of the last card, per lane
  const chain: Record<Side, number[]> = { up: [], down: [] }; // how many slid cards in a row, per lane
  const placed = entries.map((entry, i) => {
    const cx = x(entry.startsOn);
    const want = cx - CARD_W / 2;
    const order: Side[] = i % 2 === 0 ? ["up", "down"] : ["down", "up"];
    for (let lane = 0; ; lane++) {
      const options = order
        .map((side) => {
          const left = Math.max(want, (ends[side][lane] ?? -Infinity) + SPACING);
          return { side, left, shift: left - want };
        })
        .filter((o) => o.shift <= MAX_SHIFT);
      if (!options.length) continue;
      const { side, left, shift } = options.reduce((a, b) => (b.shift < a.shift ? b : a));
      ends[side][lane] = left + CARD_W;
      const link = shift > 0 ? (chain[side][lane] ?? 0) + 1 : 0;
      chain[side][lane] = link;
      return { entry, cx, left, side, lane, link };
    }
  });
  const upLanes = Math.max(1, ends.up.length);
  const downLanes = Math.max(1, ends.down.length);
  const axis = GAP + upLanes * lane;
  const width = 2 * EDGE + months * MONTH_PX;
  const height = axis + GAP + downLanes * lane;
  const todayX = x(today);
  const fillers = doodleSpots(placed, width);

  // Titles are shown in full, so a long one makes its card taller: make room for the tallest
  useEffect(() => {
    const box = cards.current;
    if (!box) return;
    const measure = () => {
      const tallest = Math.max(0, ...[...box.querySelectorAll<HTMLElement>("[data-card]")].map((c) => c.offsetHeight));
      setLane(Math.max(LANE, tallest + 26));
    };
    measure();
    const observer = new ResizeObserver(measure);
    box.querySelectorAll("[data-card]").forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [entries]);

  useEffect(() => {
    const s = scroller.current;
    if (s) s.scrollLeft = todayX - s.clientWidth * 0.75; // today near the right, the past to its left
  }, [todayX]);

  // The mouse wheel scrolls the line sideways; at either end the page scrolls as usual
  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // trackpad already scrolling sideways
      const atStart = s.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = s.scrollLeft + s.clientWidth >= s.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      s.scrollLeft += e.deltaY;
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const s = scroller.current;
    s?.scrollBy({ left: dir * s.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => scrollBy(-1)}>
          ← Earlier
        </button>
        <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => scrollBy(1)}>
          Later →
        </button>
      </div>
      {/* Faint dashed edges, so it's clear where the timeline starts and ends */}
      <div ref={scroller} className="overflow-x-auto overflow-y-hidden border-y-[1.5px] border-dashed border-ink/25 pt-4 pb-3">
        <div ref={cards} className="relative" style={{ width, height }}>
          {/* The line */}
          <span aria-hidden="true" className="absolute inset-x-0 h-[3px] -translate-y-1/2 rounded-full bg-ink/30" style={{ top: axis }} />

          {/* Months and years along it */}
          {Array.from({ length: months }, (_, i) => {
            const month = i % 12;
            const left = EDGE + i * MONTH_PX;
            return (
              <div key={i} aria-hidden="true" className="absolute" style={{ left, top: axis }}>
                <span className={`absolute left-0 w-px -translate-y-1/2 ${month === 0 ? "h-5 bg-ink/40" : "h-2 bg-ink/25"}`} />
                <span className="absolute top-2.5 left-1.5 font-mono text-[10px] text-ink-soft">{MONTHS[month]}</span>
                {month === 0 && (
                  // A year stamped onto the line
                  <span className="absolute -top-8 -translate-x-1/2 rounded-full border-[1.5px] border-ink/25 bg-paper px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
                    {firstYear + i / 12}
                  </span>
                )}
              </div>
            );
          })}

          {/* Little travel doodles where there's nothing for a while */}
          {fillers.map(({ x: fx, side, kind }) => (
            <Doodle
              key={`${side}-${fx}`}
              kind={kind}
              style={{ left: fx - 40, top: side === "up" ? axis - GAP - 170 : axis + GAP + 90 }}
            />
          ))}

          {/* Stalks from the line to each card, bent if the card slid along */}
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={width} height={height}>
            {placed.map(({ entry, cx, left, side, lane: row, link }) => {
              const dir = side === "up" ? -1 : 1;
              const reach = GAP + row * lane;
              const mid = left + CARD_W / 2;
              const bend = axis + dir * Math.max(8, reach - 12 - 9 * (link - 1)); // later ones bend nearer the line, so they never cross
              const end = axis + dir * (reach + 6);
              const d = link ? `M${cx} ${axis}V${bend}H${mid}V${end}` : `M${cx} ${axis}V${end}`;
              return <path key={entry.id} d={d} fill="none" stroke="rgb(42 38 34 / 0.25)" strokeWidth={1} />;
            })}
          </svg>

          {placed.map(({ entry, cx, left, side, lane: row }) => {
            const reach = GAP + row * lane; // line to card
            const future = entry.startsOn > today;
            return (
              <div key={entry.id}>
                {/* A short thick tick across the line where it happened */}
                <span
                  aria-hidden="true"
                  className={`absolute z-10 h-3.5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    future ? "bg-paper-deep ring-[1.5px] ring-ink/40" : "bg-ink"
                  }`}
                  style={{ left: cx, top: axis }}
                />
                <div
                  data-card
                  className={`absolute ${side === "up" ? "-rotate-2" : "rotate-2"} transition hover:z-20 hover:rotate-0`}
                  style={{
                    left,
                    width: CARD_W,
                    ...(side === "up" ? { bottom: height - axis + reach } : { top: axis + reach }),
                  }}
                >
                  <Snapshot entry={entry} future={future} />
                </div>
              </div>
            );
          })}

          {/* Today */}
          <div aria-hidden="true" className="absolute z-10" style={{ left: todayX, top: axis }}>
            <span className="absolute size-[19px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper bg-stamp shadow" />
            <span className="absolute -top-8 -translate-x-1/2 text-xs font-semibold tracking-[0.14em] text-stamp uppercase">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Phones: newest first down a vertical line (coming up, then today, then the past), a year marker wherever the year changes. */
function VerticalTimeline({ entries, today }: { entries: TimelineEntry[]; today: string }) {
  const newestFirst = [...entries].reverse();
  const todayAt = newestFirst.findIndex((e) => e.startsOn <= today);
  type Item = { kind: "meetup"; entry: TimelineEntry } | { kind: "today" } | { kind: "year"; year: string };
  const items: Item[] = [];
  let year = "";
  const markYear = (date: string) => {
    if (date.slice(0, 4) !== year) {
      year = date.slice(0, 4);
      items.push({ kind: "year", year });
    }
  };
  newestFirst.forEach((entry, i) => {
    if (i === todayAt) {
      markYear(today);
      items.push({ kind: "today" });
    }
    markYear(entry.startsOn);
    items.push({ kind: "meetup", entry });
  });
  if (todayAt === -1) {
    markYear(today);
    items.push({ kind: "today" });
  }

  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-[19px] w-[3px] rounded-full bg-ink/30" />
      {items.map((item) =>
        item.kind === "year" ? (
          <li key={`year-${item.year}`} className="relative py-2">
            <span className="relative z-10 inline-block rounded-full border-[1.5px] border-ink/25 bg-paper px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
              {item.year}
            </span>
          </li>
        ) : item.kind === "today" ? (
          <li key="today" className="relative flex items-center gap-3 py-4 pl-[11px]">
            <span className="relative z-10 block size-[19px] rounded-full border-[3px] border-paper bg-stamp shadow" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.14em] text-stamp uppercase">Today</span>
          </li>
        ) : (
          <li key={item.entry.id} className="relative flex gap-4 py-3">
            <span
              aria-hidden="true"
              className={`relative z-10 mt-5 ml-[12px] size-[17px] shrink-0 rounded-full border-[3px] border-paper shadow ${
                item.entry.startsOn > today ? "bg-paper-deep ring-2 ring-ink/30" : "bg-ink"
              }`}
            />
            <div className="min-w-0 flex-1">
              <Snapshot entry={item.entry} future={item.entry.startsOn > today} />
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

/** A snapshot: photo in a white border, caption underneath. */
function Snapshot({ entry: e, future }: { entry: TimelineEntry; future: boolean }) {
  return (
    <Link
      href={`/timeline/${e.id}`}
      className={`group block rounded-[4px] bg-[#fffdf8] p-2 pb-3 shadow-[0_1px_2px_rgb(42_38_34/0.1),0_12px_24px_-14px_rgb(42_38_34/0.5)] ring-1 ring-ink/10 transition hover:shadow-[0_1px_2px_rgb(42_38_34/0.1),0_18px_30px_-14px_rgb(42_38_34/0.55)] ${
        future ? "opacity-80" : ""
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-[2px] bg-paper-deep">
        {e.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.photoUrl} alt="" className="size-full object-cover" style={{ objectPosition: e.photoFocus }} loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-3xl text-ink-soft/50" aria-hidden="true">
            ✶
          </div>
        )}
      </div>
      <div className="px-1 pt-2.5">
        <p className="text-[11px] font-medium tracking-wide text-ink-soft uppercase">
          {future ? "Coming up · " : ""}
          {e.dates}
        </p>
        <p className="mt-0.5 font-display text-lg leading-snug font-semibold break-words">{e.title}</p>
        {e.places.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-ink-soft">
            <span className="mt-[3px] shrink-0">
              <Flag code={e.places[0].countryCode} size={14} />
            </span>
            <span className="min-w-0 break-words">{placesLabel(e.places)}</span>
          </p>
        )}
        {e.members.length > 0 && (
          <span className="mt-2 flex -space-x-1.5">
            {e.members.slice(0, 7).map((m) => (
              <Avatar key={m.id} name={m.display_name} color={m.color} url={m.avatar_url} size={24} />
            ))}
            {e.members.length > 7 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-paper-deep text-[10px] font-semibold ring-2 ring-[#fffdf8]">
                +{e.members.length - 7}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}

type DoodleKind = "plane" | "compass" | "postmark" | "balloon" | "stamp";
const DOODLES: DoodleKind[] = ["plane", "postmark", "compass", "balloon", "stamp"];

/**
 * Where to draw doodles: every stretch of a side with no card on it for a while
 * gets one every ~300px, skipping the ends so they don't crowd a card.
 */
function doodleSpots(placed: { left: number; side: "up" | "down"; lane: number }[], width: number) {
  const spots: { x: number; side: "up" | "down"; kind: DoodleKind }[] = [];
  for (const side of ["up", "down"] as const) {
    const taken = placed
      .filter((p) => p.side === side && p.lane === 0)
      .map((p) => [p.left, p.left + CARD_W])
      .sort((a, b) => a[0] - b[0]);
    let from = EDGE;
    for (const [l, r] of [...taken, [width - EDGE, width]]) {
      const room = l - from - 2 * 90;
      for (let n = Math.floor(room / 300), k = 0; k < n; k++) {
        const fx = Math.round(from + 90 + (room / n) * (k + 0.5));
        spots.push({ x: fx, side, kind: DOODLES[(Math.round(fx / 97) + (side === "up" ? 0 : 2)) % DOODLES.length] });
      }
      from = Math.max(from, r);
    }
  }
  return spots;
}

/** A faint pencil doodle, like the margins of a travel journal. */
function Doodle({ kind, style }: { kind: DoodleKind; style: React.CSSProperties }) {
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg aria-hidden="true" viewBox="0 0 80 80" className="pointer-events-none absolute size-20 text-ink/15" style={style}>
      {kind === "plane" && (
        <>
          <path {...line} d="M12 52 66 26 40 62 36 46Z M36 46 66 26" />
          <path {...line} strokeDasharray="2 5" d="M10 66c8-2 14-6 20-12" />
        </>
      )}
      {kind === "compass" && (
        <>
          <circle {...line} cx="40" cy="40" r="26" />
          <path {...line} d="M40 18 46 40 40 62 34 40Z M18 40h6M56 40h6" />
          <text x="40" y="12" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="var(--font-mono)">
            N
          </text>
        </>
      )}
      {kind === "postmark" && (
        <>
          <circle {...line} cx="30" cy="40" r="18" />
          <circle {...line} cx="30" cy="40" r="13" strokeDasharray="1 3" />
          <path {...line} d="M48 32c6-4 10 4 16 0s10 4 14 0M48 40c6-4 10 4 16 0s10 4 14 0M48 48c6-4 10 4 16 0s10 4 14 0" />
        </>
      )}
      {kind === "balloon" && (
        <>
          <path {...line} d="M40 12c-13 0-21 10-21 21 0 12 12 20 17 27h8c5-7 17-15 17-27 0-11-8-21-21-21Z M36 60l1 8M44 60l-1 8" />
          <rect {...line} x="35" y="68" width="10" height="7" rx="1" />
          <path {...line} d="M40 12c-6 8-6 40-4 48M40 12c6 8 6 40 4 48" />
        </>
      )}
      {kind === "stamp" && (
        <>
          <rect {...line} x="20" y="16" width="40" height="48" strokeDasharray="3 2.5" />
          <rect {...line} x="26" y="22" width="28" height="36" />
          <path {...line} d="M30 50l7-10 6 6 4-5 5 9" />
          <circle {...line} cx="46" cy="31" r="3" />
        </>
      )}
    </svg>
  );
}
