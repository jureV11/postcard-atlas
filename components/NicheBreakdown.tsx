"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { NicheFacts, NicheFactorResult } from "@/lib/niche";
import type { NicheFactor } from "@/lib/niche.config";
import { formatCount } from "@/lib/utils";

const LABELS: Record<NicheFactor, string> = {
  distance: "Far from the group",
  tourism: "Rarely visited country",
  population: "Small place",
  remoteness: "Far from an airport",
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
        <div className="border-t border-ink/10 bg-paper/60 px-4 py-3">
          <FactorList factors={factors} facts={facts} country={country} />
        </div>
      )}
    </div>
  );
}

/** The postcard page's score: a tile that opens the same breakdown. */
export function NicheCard({
  score,
  factors,
  facts,
  country,
}: {
  score: number;
  factors: NicheFactorResult[];
  facts: NicheFacts;
  country: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-paper/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">Nicheness</span>
          <span className="block text-sm text-ink-soft">
            How off-the-beaten-path this town is · {open ? "hide" : "see"} why
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tabular-nums">{score}</span>
          <span className="text-sm text-ink-soft">/ 100 {open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-ink/10 bg-paper/60 px-5 py-4">
          <FactorList factors={factors} facts={facts} country={country} />
        </div>
      )}
    </section>
  );
}

function FactorList({ factors, facts, country }: { factors: NicheFactorResult[]; facts: NicheFacts; country: string }) {
  return (
    <div className="space-y-2.5">
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
  );
}

function describe(factor: NicheFactor, f: NicheFacts, country: string): ReactNode {
  switch (factor) {
    case "distance":
      return f.homeKm === null
        ? "No homes to measure from"
        : `${Math.round(f.homeKm).toLocaleString("en")} km from the nearest friend's home${f.nearestFriend ? ` (${f.nearestFriend})` : ""}`;
    case "tourism":
      return f.touristArrivals === null
        ? `No tourism figures for ${country}`
        : `${country} gets about ${formatCount(f.touristArrivals)} tourists a year (${f.tourismYear})`;
    case "population":
      return f.population === null ? "Population not found" : `About ${formatCount(f.population)} people live here`;
    case "remoteness":
      return f.airportKm === null
        ? "No airport data"
        : `${Math.round(f.airportKm).toLocaleString("en")} km to the nearest airport with scheduled flights`;
  }
}
