"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/Avatar";
import { WallPostcard } from "@/components/WallPostcard";
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

/**
 * The received postcards as a journey: a dashed airmail route down the side
 * with a date stamp for each month, and the cards pinned up beside it.
 * Filter by search words and/or one friend (sent or received).
 */
export function PostcardsBrowser({ groups, total }: { groups: BrowserGroup[]; total: number }) {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const words = fold(query).split(/\s+/).filter(Boolean);

  // Everyone who appears on a card, most cards first.
  const people = useMemo(() => {
    const count = new Map<string, { m: MemberWithAvatar; n: number }>();
    for (const g of groups)
      for (const i of g.items)
        for (const m of [i.sender, i.recipient])
          if (m) count.set(m.id, { m, n: (count.get(m.id)?.n ?? 0) + 1 });
    return [...count.values()].sort((a, b) => b.n - a.n).map((x) => x.m);
  }, [groups]);

  const shown = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (i) =>
              words.every((w) => i.search.includes(w)) &&
              (!person || i.sender?.id === person || i.recipient?.id === person),
          ),
        }))
        .filter((g) => g.items.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, words.join(" "), person],
  );
  const matches = shown.reduce((t, g) => t + g.items.length, 0);
  const filtering = words.length > 0 || person !== null;

  return (
    <div className="space-y-6">
      {total > 1 && (
        <div className="space-y-3">
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
          </div>
          {people.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Show one friend's postcards">
              {people.map((m) => {
                const on = person === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPerson(on ? null : m.id)}
                    aria-pressed={on}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition ${
                      on ? "border-ink bg-ink text-paper" : "border-ink/15 bg-[#fffdf8] hover:border-ink/40"
                    }`}
                  >
                    <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={24} />
                    {m.display_name}
                  </button>
                );
              })}
            </div>
          )}
          {filtering && (
            <p className="text-sm text-ink-soft" aria-live="polite">
              {matches === 0 ? "No postcards match" : `${matches} of ${total} ${total === 1 ? "postcard" : "postcards"}`}
              {" — "}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPerson(null);
                }}
                className="font-medium text-stamp hover:underline"
              >
                show all
              </button>
            </p>
          )}
        </div>
      )}

      {/* The journey: a dashed route with a stamp per month */}
      <ol className="relative space-y-10 pl-7 sm:pl-10">
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[9px] top-3 w-0 border-l-2 border-dashed border-stamp/35 sm:left-[13px]"
        />
        {shown.map((g) => {
          const [y, m] = g.key.split("-").map(Number);
          return (
            <li key={g.key} className="relative space-y-4">
              <span
                aria-hidden="true"
                className="absolute -left-7 top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-stamp bg-paper sm:-left-10 sm:size-7"
              >
                <span className="size-1.5 rounded-full bg-stamp sm:size-2" />
              </span>
              <div className="flex items-center gap-3">
                <span className="date-stamp">
                  {MONTHS[m - 1]} {y}
                </span>
                <span className="font-hand text-xl text-ink-soft">
                  {g.items.length} {g.items.length === 1 ? "card" : "cards"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
                {g.items.map((i, n) => (
                  <div key={i.card.id} className="deal-in" style={{ "--i": n } as CSSProperties}>
                    <WallPostcard card={i.card} frontUrl={i.frontUrl} sender={i.sender} recipient={i.recipient} />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
