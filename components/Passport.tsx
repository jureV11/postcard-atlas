import { continentProgress } from "@/lib/continents";
import type { LocatedPostcard } from "@/lib/types";

const INKS = ["#2f4b8a", "#a3322c", "#2e6b4f", "#6b3f8a", "#8a5a1e", "#1f6f7a"];
const SHAPES = ["circle", "rect", "oval", "octagon"] as const;

/** Stable small hash so each country always gets the same stamp. */
function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function stampDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day))
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

/** A passport page: one ink stamp per country this member has sent a postcard from. */
export function Passport({ cards, filterId }: { cards: LocatedPostcard[]; filterId: string }) {
  // Earliest card per country = the "entry" stamp.
  const byCountry = new Map<string, { code: string; name: string; first: string; count: number }>();
  for (const c of cards) {
    const e = byCountry.get(c.from_country_code);
    if (!e) byCountry.set(c.from_country_code, { code: c.from_country_code, name: c.from_country, first: c.sent_on, count: 1 });
    else {
      e.count++;
      if (c.sent_on < e.first) e.first = c.sent_on;
    }
  }
  const stamps = [...byCountry.values()].sort((a, b) => a.first.localeCompare(b.first));
  const continents = continentProgress(stamps.map((s) => s.code));
  const inkId = `ink-${filterId}`;

  return (
    <div className="space-y-5">
      {/* Shared "rough ink" texture for every stamp on the page */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={inkId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" />
        </filter>
      </svg>

      <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-[#fbf6ea] p-4 shadow-sm sm:p-6">
        {/* faint security-paper lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #2f4b8a 0 1px, transparent 1px 9px), repeating-linear-gradient(45deg, #a3322c 0 1px, transparent 1px 13px)",
          }}
        />
        {stamps.length === 0 ? (
          <p className="relative py-10 text-center text-ink-soft">No stamps yet — the first postcard that arrives fills this page.</p>
        ) : (
          <ul className="relative grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {stamps.map((s) => (
              <li key={s.code} className="flex justify-center">
                <InkStamp {...s} filterId={inkId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {continents.map((c) => (
          <div key={c.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="tabular-nums text-ink-soft">
                {c.visited} / {c.total}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full rounded-full bg-stamp transition-all"
                style={{ width: `${(c.visited / c.total) * 100}%`, minWidth: c.visited ? 6 : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InkStamp({
  code,
  name,
  first,
  count,
  filterId,
}: {
  code: string;
  name: string;
  first: string;
  count: number;
  filterId: string;
}) {
  const h = hash(code);
  const ink = INKS[h % INKS.length];
  const shape = SHAPES[(h >> 3) % SHAPES.length];
  const tilt = ((h >> 6) % 21) - 10; // -10°..10°
  const label = name.toUpperCase();
  const fontSize = label.length > 14 ? 8.5 : label.length > 10 ? 10 : 12;

  return (
    <svg
      viewBox="0 0 140 100"
      className="w-full max-w-[150px]"
      style={{ transform: `rotate(${tilt}deg)`, mixBlendMode: "multiply" }}
      role="img"
      aria-label={`${name} — first postcard ${stampDate(first)}${count > 1 ? `, ${count} postcards` : ""}`}
    >
      <g filter={`url(#${filterId})`} fill="none" stroke={ink} strokeOpacity="0.85" opacity="0.92">
        {shape === "circle" && (
          <>
            <circle cx="70" cy="50" r="46" strokeWidth="3" />
            <circle cx="70" cy="50" r="40" strokeWidth="1.2" />
          </>
        )}
        {shape === "rect" && (
          <>
            <rect x="6" y="10" width="128" height="80" rx="6" strokeWidth="3" />
            <rect x="12" y="16" width="116" height="68" rx="3" strokeWidth="1.2" />
          </>
        )}
        {shape === "oval" && (
          <>
            <ellipse cx="70" cy="50" rx="64" ry="44" strokeWidth="3" />
            <ellipse cx="70" cy="50" rx="57" ry="37" strokeWidth="1.2" />
          </>
        )}
        {shape === "octagon" && (
          <>
            <polygon points="34,6 106,6 134,30 134,70 106,94 34,94 6,70 6,30" strokeWidth="3" />
            <polygon points="37,13 103,13 127,33 127,67 103,87 37,87 13,67 13,33" strokeWidth="1.2" />
          </>
        )}
        <g fill={ink} stroke="none" fontFamily="ui-monospace, 'Courier New', monospace" textAnchor="middle" fontWeight="700">
          <text x="70" y="40" fontSize={fontSize} letterSpacing="1">
            {label}
          </text>
          <text x="70" y="58" fontSize="9" letterSpacing="0.5">
            {stampDate(first)}
          </text>
          <text x="70" y="73" fontSize="8" letterSpacing="2" opacity="0.8">
            {count > 1 ? `ENTRY ×${count}` : "ENTRY"} · {code}
          </text>
        </g>
      </g>
    </svg>
  );
}
