"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import type { MemberWithAvatar } from "@/lib/types";

export type TimelineEntry = {
  id: string;
  title: string;
  dates: string;
  startsOn: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  photoUrl: string | null;
  members: MemberWithAvatar[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_PX = 72; // every month is the same width, so the line is to scale
const EDGE = 130; // room before the first month and after the last, for a card on the edge
const CARD_W = 208;
const LANE = 290; // a card plus a gap: cards close in time stack outward in lanes
const GAP = 44; // line to the nearest card

/**
 * Meetups on a line from past to future. From `sm` up it's to scale (a month is
 * always the same width) and scrolls sideways, photos sticking out above and
 * below at their month. On phones it's a simple list down a vertical line.
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
          const text = [e.title, e.city, e.country, e.dates, e.startsOn.slice(0, 4), ...e.members.map((m) => m.display_name)]
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
                    <img src={e.photoUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-ink-soft">
                    {e.countryCode && <Flag code={e.countryCode} size={12} />}
                    {[e.city, e.dates].filter(Boolean).join(" · ")}
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

  const firstYear = Math.min(yearOf(today), ...entries.map((e) => yearOf(e.startsOn)));
  const lastYear = Math.max(yearOf(today), ...entries.map((e) => yearOf(e.startsOn)));
  const months = (lastYear - firstYear + 1) * 12;
  const x = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return EDGE + ((y - firstYear) * 12 + (m - 1) + (d - 1) / daysInMonth) * MONTH_PX;
  };

  // Alternate above and below the line; a card that would overlap one already
  // placed on that side moves out a lane (or to the other side, if that's free).
  const ends: Record<"up" | "down", number[]> = { up: [], down: [] };
  const placed = entries.map((entry, i) => {
    const cx = x(entry.startsOn);
    const sides = i % 2 === 0 ? (["up", "down"] as const) : (["down", "up"] as const);
    for (let lane = 0; ; lane++) {
      const side = sides.find((s) => (ends[s][lane] ?? -Infinity) + 16 <= cx - CARD_W / 2);
      if (side) {
        ends[side][lane] = cx + CARD_W / 2;
        return { entry, cx, side, lane };
      }
    }
  });
  const upLanes = Math.max(1, ends.up.length);
  const downLanes = Math.max(1, ends.down.length);
  const axis = GAP + upLanes * LANE;
  const width = 2 * EDGE + months * MONTH_PX;
  const height = axis + GAP + downLanes * LANE;
  const todayX = x(today);

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
      <div ref={scroller} className="overflow-x-auto overflow-y-hidden pb-3">
        <div className="relative" style={{ width, height }}>
          {/* The line */}
          <span aria-hidden="true" className="absolute inset-x-0 h-[3px] -translate-y-1/2 rounded-full bg-ink/15" style={{ top: axis }} />

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

          {placed.map(({ entry, cx, side, lane }) => {
            const reach = GAP + lane * LANE; // line to card
            const future = entry.startsOn > today;
            return (
              <div key={entry.id}>
                {/* Stalk from the line to the card */}
                <span
                  aria-hidden="true"
                  className="absolute w-px bg-ink/25"
                  style={{ left: cx, height: reach, top: side === "up" ? axis - reach : axis }}
                />
                <span
                  aria-hidden="true"
                  className={`absolute z-10 size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper shadow ${
                    future ? "bg-paper-deep ring-2 ring-ink/30" : "bg-ink"
                  }`}
                  style={{ left: cx, top: axis }}
                />
                <div
                  className={`absolute ${side === "up" ? "-rotate-2" : "rotate-2"} transition hover:z-20 hover:rotate-0`}
                  style={{
                    left: cx - CARD_W / 2,
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

/** Phones: a list down a vertical line, with a year marker wherever a new year starts. */
function VerticalTimeline({ entries, today }: { entries: TimelineEntry[]; today: string }) {
  const todayAt = entries.findIndex((e) => e.startsOn > today);
  type Item = { kind: "meetup"; entry: TimelineEntry } | { kind: "today" } | { kind: "year"; year: string };
  const items: Item[] = [];
  let year = "";
  const markYear = (date: string) => {
    if (date.slice(0, 4) !== year) {
      year = date.slice(0, 4);
      items.push({ kind: "year", year });
    }
  };
  entries.forEach((entry, i) => {
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
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-[19px] w-[3px] rounded-full bg-ink/15" />
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
          <img src={e.photoUrl} alt="" className="size-full object-cover" loading="lazy" />
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
        <p className="mt-0.5 truncate font-display text-lg leading-snug font-semibold">{e.title}</p>
        {e.city && (
          <p className="flex items-center gap-1.5 truncate text-sm text-ink-soft">
            {e.countryCode && <Flag code={e.countryCode} size={14} />}
            {e.city}
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
