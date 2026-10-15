"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { NicheFacts, NicheFactorResult } from "@/lib/niche";
import type { NicheFactor } from "@/lib/niche.config";

const LABELS: Record<NicheFactor, string> = {
  population: "Small place",
  remoteness: "Far from an airport",
  tourism: "Few tourists",
  obscurity: "Little-known",
};

/** A leaderboard row: the row opens the postcard, the score opens its breakdown. */
export function NicheRow({
  href,
  score,
  factors,
  facts,
  country,
  children,
}: {
  href: string;
  score: number;
  factors: NicheFactorResult[];
  facts: NicheFacts;
  country: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/75">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
          {children}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Niche score ${score} out of 100 — ${open ? "hide" : "show"} how it was scored`}
          className="flex shrink-0 flex-col items-center rounded-xl bg-ink px-2.5 py-1 text-paper transition hover:bg-ink/85"
        >
          <span className="font-display text-lg font-semibold leading-tight tabular-nums">{score}</span>
          <span className="text-[10px] leading-tight text-paper/70">/ 100 {open ? "▴" : "▾"}</span>
        </button>
      </div>
      {open && (
        <div className="space-y-2.5 border-t border-ink/10 bg-paper/60 px-4 py-3">
          {factors.map((f) => (
            <div key={f.factor}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{LABELS[f.factor]}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {f.value === null ? "not counted" : `${Math.round(f.points)} / ${Math.round(f.max)}`}
                </span>
              </div>
              {f.value !== null && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-stamp" style={{ width: `${Math.round(f.value * 100)}%` }} />
                </div>
              )}
              <p className="mt-0.5 text-xs text-ink-soft">{describe(f.factor, facts, country)}</p>
            </div>
          ))}
          {factors.some((f) => f.value === null) && (
            <p className="text-[11px] text-ink-soft">
              Anything “not counted” had no data, so its points were shared among the others — nothing is guessed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function describe(factor: NicheFactor, f: NicheFacts, country: string): ReactNode {
  switch (factor) {
    case "population":
      return f.population === null ? "Population not found" : `About ${formatCount(f.population)} people live here`;
    case "remoteness":
      return f.airportKm === null
        ? "No airport data"
        : `${Math.round(f.airportKm).toLocaleString("en")} km to the nearest airport with scheduled flights`;
    case "tourism":
      return f.touristsPerResident === null
        ? `No tourism figures for ${country}`
        : `${country} gets ${formatRatio(f.touristsPerResident)} tourist${f.touristsPerResident === 1 ? "" : "s"} per resident a year (${f.tourismYear})`;
    case "obscurity":
      return f.wikiMonthlyViews === null || !f.wikiTitle ? (
        "No English Wikipedia article found"
      ) : (
        <>
          {formatCount(Math.round(f.wikiMonthlyViews))} views a month on{" "}
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(f.wikiTitle.replaceAll(" ", "_"))}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-ink"
          >
            Wikipedia
          </a>
        </>
      );
  }
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRatio(r: number): string {
  return r >= 10 ? String(Math.round(r)) : r >= 1 ? r.toFixed(1) : r.toFixed(2);
}
