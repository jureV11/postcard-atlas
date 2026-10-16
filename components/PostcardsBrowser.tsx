"use client";

import { useMemo, useState } from "react";
import { PostcardTile } from "@/components/PostcardTile";
import type { MemberWithAvatar, Postcard } from "@/lib/types";
import { fold } from "@/lib/utils";

export type BrowserItem = {
  card: Postcard;
  frontUrl: string | null;
  sender?: MemberWithAvatar;
  recipient?: MemberWithAvatar;
  /** Everything you can search this card by, already lower-cased. */
  search: string;
};
export type BrowserGroup = { key: string; items: BrowserItem[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The received postcards, grouped by month with a date-stamp heading, plus search. */
export function PostcardsBrowser({ groups, total }: { groups: BrowserGroup[]; total: number }) {
  const [query, setQuery] = useState("");
  const words = fold(query).split(/\s+/).filter(Boolean);

  const shown = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, items: g.items.filter((i) => words.every((w) => i.search.includes(w))) }))
        .filter((g) => g.items.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, words.join(" ")],
  );
  const matches = shown.reduce((t, g) => t + g.items.length, 0);

  return (
    <div className="space-y-6">
      {total > 1 && (
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search town, country, person, month…"
            aria-label="Search postcards"
            className="input pl-10"
          />
          {words.length > 0 && (
            <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
              {matches === 0 ? "No postcards match" : `${matches} of ${total} ${total === 1 ? "postcard" : "postcards"}`}
              {matches === 0 && (
                <>
                  {" — "}
                  <button type="button" onClick={() => setQuery("")} className="font-medium text-stamp hover:underline">
                    clear the search
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {shown.map((g) => {
        const [y, m] = g.key.split("-").map(Number);
        return (
          <div key={g.key} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="date-stamp">
                {MONTHS[m - 1]} {y}
              </span>
              <span className="font-hand text-xl text-ink-soft">
                {g.items.length} {g.items.length === 1 ? "card" : "cards"} sent
              </span>
              <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
              {g.items.map((i) => (
                <PostcardTile key={i.card.id} card={i.card} frontUrl={i.frontUrl} sender={i.sender} recipient={i.recipient} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
