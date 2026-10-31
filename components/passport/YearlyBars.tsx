"use client";

import { useState } from "react";
import type { YearBar } from "@/lib/passport";

const SHOWN = 10; // years on screen at once; a slider moves through older ones

/**
 * Postcards delivered per year: one series, so no legend. The busiest year is
 * highlighted, a dashed line marks the average, and hovering (or tapping) a
 * year shows its exact count. With more than 10 years, a slider scrolls back.
 */
export function YearlyBars({ years: all }: { years: YearBar[] }) {
  const lastStart = Math.max(0, all.length - SHOWN);
  const [start, setStart] = useState(lastStart); // newest years first
  const [hover, setHover] = useState<number | null>(null);
  const years = all.slice(start, start + SHOWN);

  const max = Math.max(1, ...years.map((y) => y.count));
  const top = niceMax(Math.max(2, max)); // at least 2, so the mid line is a whole number
  const avg = years.reduce((t, y) => t + y.count, 0) / years.length;
  const busiest = years.reduce((b, y, i) => (y.count > years[b].count ? i : b), 0);
  const shown = hover ?? busiest;
  const range = `${years[0].year}–${years[years.length - 1].year}`;

  return (
    <div className="pr-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{years[shown].year}</span> · {years[shown].count}{" "}
          {years[shown].count === 1 ? "postcard" : "postcards"}
          {hover === null && years[busiest].count > 0 && " — busiest year"}
        </p>
        <p className="shrink-0 font-mono text-xs text-ink-soft tabular-nums">avg {avg.toFixed(1)}/yr</p>
      </div>

      <div className="relative flex h-36 gap-1 border-b border-ink/15" role="img" aria-label={`Postcards delivered per year, ${range}`}>
        {/* Recessive grid: top and middle */}
        {[1, 0.5].map((f) => (
          <div
            key={f}
            className="pointer-events-none absolute inset-x-0 border-t border-ink/[0.07]"
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="absolute -top-2 right-0 translate-x-full pl-1.5 font-mono text-[10px] text-ink-soft tabular-nums">
              {Math.round(top * f)}
            </span>
          </div>
        ))}
        {/* Average */}
        {avg > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink/45"
            style={{ bottom: `${(avg / top) * 100}%` }}
          />
        )}
        {years.map((y, i) => {
          const h = (y.count / top) * 100;
          const strong = i === shown && y.count > 0;
          return (
            <button
              key={y.year}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={`${y.year}: ${y.count} ${y.count === 1 ? "postcard" : "postcards"}`}
              className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${
                  strong ? "bg-stamp" : "bg-stamp/30 group-hover:bg-stamp/50"
                }`}
                style={{ height: y.count ? `max(${h}%, 3px)` : "0" }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1" aria-hidden="true">
        {years.map((y, i) => (
          <span
            key={y.year}
            className={`flex-1 text-center font-mono text-[10px] ${i === shown ? "font-semibold text-ink" : "text-ink-soft"}`}
          >
            {/* Two digits ('24) when ten years share a phone-width row */}
            <span className="sm:hidden">&apos;{String(y.year).slice(2)}</span>
            <span className="hidden sm:inline">{y.year}</span>
          </span>
        ))}
      </div>

      {lastStart > 0 && (
        <label className="mt-4 flex items-center gap-3 text-xs text-ink-soft">
          <span className="shrink-0 font-mono tabular-nums">{all[0].year}</span>
          <input
            type="range"
            min={0}
            max={lastStart}
            value={start}
            onChange={(e) => {
              setStart(Number(e.target.value));
              setHover(null);
            }}
            aria-label={`Years shown: ${range}`}
            className="h-1.5 w-full cursor-pointer accent-stamp"
          />
          <span className="shrink-0 font-mono tabular-nums">{all[all.length - 1].year}</span>
        </label>
      )}

      {/* The same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Postcards delivered per year</caption>
        <tbody>
          {all.map((y) => (
            <tr key={y.year}>
              <th scope="row">{y.year}</th>
              <td>{y.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A round axis maximum: 1, 2, 4, 5, 10, 20… */
function niceMax(n: number): number {
  const steps = [1, 2, 4, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(n));
  for (const s of steps) if (s * mag >= n) return s * mag;
  return 10 * mag;
}
