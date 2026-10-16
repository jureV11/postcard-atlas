"use client";

import { useState } from "react";
import type { MonthBar } from "@/lib/passport";

/**
 * Postcards delivered per month: one series, so no legend. The busiest month is
 * highlighted, a dashed line marks the average, and hovering (or tapping) a
 * month shows its exact count.
 */
export function MonthlyBars({ months }: { months: MonthBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.count));
  const top = niceMax(Math.max(2, max)); // at least 2, so the mid line is a whole number
  const avg = months.reduce((t, m) => t + m.count, 0) / months.length;
  const busiest = months.reduce((b, m, i) => (m.count > months[b].count ? i : b), 0);
  const shown = hover ?? busiest;

  return (
    <div className="pr-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">
            {months[shown].label} {months[shown].year}
          </span>{" "}
          · {months[shown].count} {months[shown].count === 1 ? "postcard" : "postcards"}
          {hover === null && months[busiest].count > 0 && " — busiest month"}
        </p>
        <p className="shrink-0 font-mono text-xs text-ink-soft tabular-nums">avg {avg.toFixed(1)}/mo</p>
      </div>

      <div className="relative flex h-36 gap-[2px] border-b border-ink/15" role="img" aria-label="Postcards delivered per month, last 12 months">
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
        {months.map((m, i) => {
          const h = (m.count / top) * 100;
          const strong = i === shown && m.count > 0;
          return (
            <button
              key={m.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={`${m.label} ${m.year}: ${m.count} ${m.count === 1 ? "postcard" : "postcards"}`}
              className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${
                  strong ? "bg-stamp" : "bg-stamp/30 group-hover:bg-stamp/50"
                }`}
                style={{ height: m.count ? `max(${h}%, 3px)` : "0" }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-[2px]" aria-hidden="true">
        {months.map((m, i) => (
          <span
            key={m.key}
            className={`flex-1 text-center font-mono text-[10px] ${i === shown ? "font-semibold text-ink" : "text-ink-soft"}`}
          >
            {m.label[0]}
          </span>
        ))}
      </div>

      {/* The same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Postcards delivered per month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">
                {m.label} {m.year}
              </th>
              <td>{m.count}</td>
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
