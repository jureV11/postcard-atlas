import Link from "next/link";
import type { ReactNode } from "react";
import { Flag } from "@/components/Flag";
import { formatKm } from "@/lib/geo";
import { EARTH_KM } from "@/lib/passport";
import type { GroupStats as Stats, TimedCard } from "@/lib/stats";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";

/**
 * "Group stats" at the top of the Postcards tab, drawn as the back of a
 * postcard in an airmail border: a handwritten message on the left, stamp,
 * postmark and the fastest/slowest cards as "address lines" on the right.
 */
export function GroupStats({
  stats,
  countries,
  membersById,
}: {
  stats: Stats;
  countries: number;
  membersById: Map<string, MemberWithAvatar>;
}) {
  const laps = stats.totalKm / EARTH_KM;
  const avg = stats.avgDays === null ? null : stats.avgDays.toFixed(stats.avgDays < 10 ? 1 : 0);

  return (
    <div>
      <section aria-labelledby="group-stats-title" className="airmail">
        <div className="paper relative grid gap-6 px-5 py-5 sm:px-7 md:grid-cols-[minmax(0,1.15fr)_1px_minmax(0,1fr)] md:gap-7">
          {/* Message side */}
          <div>
            <h2 id="group-stats-title" className="font-hand text-[1.9rem] leading-none text-ink">
              Greetings from all of us!
            </h2>
            <div className="ruled mt-2 font-hand text-[1.45rem] text-ink/85">
              <p>
                Together we&apos;ve delivered <Big>{stats.delivered.toLocaleString("en")}</Big>{" "}
                {stats.delivered === 1 ? "postcard" : "postcards"}
                {countries > 0 && (
                  <>
                    {" "}
                    from <Big>{countries}</Big> {countries === 1 ? "country" : "countries"}
                  </>
                )}
                ,
              </p>
              <p>
                travelling <Big>{Math.round(stats.totalKm).toLocaleString("en")} km</Big>
                {laps >= 0.05 && <> — that&apos;s {laps.toFixed(laps < 10 ? 1 : 0)}× around the Earth</>}.
              </p>
              {avg && (
                <p>
                  Each one spent about <Big>{avg} days</Big> in the post.
                </p>
              )}
              <p className="text-right">— the group ✉</p>
            </div>
          </div>

          {/* The dividing line on a postcard back */}
          <div className="hidden bg-ink/15 md:block" aria-hidden="true" />

          {/* Address side */}
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <Postmark days={avg} />
              <Stamp count={stats.delivered} />
            </div>

            <div className="mt-4 space-y-1">
              {stats.fastest && <AddressLine title="Fastest" entry={stats.fastest} membersById={membersById} />}
              {stats.slowest && <AddressLine title="Slowest" entry={stats.slowest} membersById={membersById} />}
              {!stats.fastest && !stats.slowest && (
                <p className="border-b border-ink/20 pb-1 font-hand text-xl text-ink-soft">Waiting for the first card…</p>
              )}
            </div>
          </div>
        </div>
      </section>
      <p className="mt-2 text-center text-xs text-ink-soft">
        <span className="font-medium uppercase tracking-[0.18em]">Par avion</span> · delivered cards only — anything still on
        its way stays a surprise
      </p>
    </div>
  );
}

function Big({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-stamp">{children}</strong>;
}

/** Perforated stamp with the number of cards delivered. */
function Stamp({ count }: { count: number }) {
  return (
    // Perforated edge: a dotted, round-capped stroke in the paper colour makes the scallops.
    <svg
      viewBox="0 0 76 92"
      className="h-[92px] w-[76px] shrink-0 rotate-3 drop-shadow-[0_1px_1.5px_rgb(42_38_34/0.35)]"
      role="img"
      aria-label={`${count} postcards delivered`}
    >
      <rect x="5" y="5" width="66" height="82" fill="#fff" stroke="#fff" strokeWidth="6" strokeDasharray="0.01 6.6" strokeLinecap="round" />
      <rect x="10" y="10" width="56" height="72" fill="#f4e3d7" stroke="#c2503a" strokeOpacity="0.45" />
      <g fill="#c2503a" textAnchor="middle">
        <text x="38" y="44" fontSize="22" fontWeight="700" fontFamily="var(--font-mono)">
          {count}
        </text>
        <text x="38" y="57" fontSize="8" fontWeight="600" letterSpacing="1.6">
          CARDS
        </text>
        <text x="38" y="72" fontSize="6.5" letterSpacing="1.2" opacity="0.7">
          ATLAS POST
        </text>
      </g>
    </svg>
  );
}

/** Round cancellation mark with the average delivery time in the middle. */
function Postmark({ days }: { days: string | null }) {
  return (
    <svg viewBox="0 0 170 96" className="h-[88px] w-auto -rotate-6 text-[#24345e]" role="img" aria-label="Postmark">
      <defs>
        <path id="gs-pm-top" d="M 14 48 A 34 34 0 0 1 82 48" />
        <path id="gs-pm-bot" d="M 10 48 A 38 38 0 0 0 86 48" />
      </defs>
      <g fill="none" stroke="currentColor" opacity="0.8">
        <circle cx="48" cy="48" r="45" strokeWidth="2.5" />
        <circle cx="48" cy="48" r="27" strokeWidth="1.2" />
        {[30, 42, 54, 66].map((y) => (
          <path key={y} d={`M 100 ${y} q 8 -5 16 0 t 16 0 t 16 0 t 16 0`} strokeWidth="2" />
        ))}
      </g>
      <g fill="currentColor" opacity="0.85" fontFamily="var(--font-mono)" fontWeight="700">
        <text fontSize="8.5" letterSpacing="2">
          <textPath href="#gs-pm-top" startOffset="50%" textAnchor="middle">
            POSTCARD ATLAS
          </textPath>
        </text>
        <text fontSize="7.5" letterSpacing="2">
          <textPath href="#gs-pm-bot" startOffset="50%" textAnchor="middle">
            AVG IN THE POST
          </textPath>
        </text>
        <text x="48" y="51" textAnchor="middle" fontSize="15">
          {days ?? "—"}
        </text>
        <text x="48" y="61" textAnchor="middle" fontSize="7" letterSpacing="1">
          DAYS
        </text>
      </g>
    </svg>
  );
}

function AddressLine({
  title,
  entry,
  membersById,
}: {
  title: string;
  entry: TimedCard;
  membersById: Map<string, MemberWithAvatar>;
}) {
  const { card, km, days, kmPerDay } = entry;
  const sender = membersById.get(card.sender_id);
  const recipient = membersById.get(card.recipient_id);
  return (
    <Link href={`/postcards/${card.id}`} className="group block border-b border-ink/20 pb-1.5 pt-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{title}</span>
        <span className="font-mono text-xs tabular-nums text-ink-soft">
          {Math.round(kmPerDay).toLocaleString("en")} km/day
        </span>
      </span>
      <span className="flex items-center gap-1.5 font-hand text-[1.35rem] leading-tight group-hover:text-stamp">
        <Flag code={card.from_country_code} size={14} />
        <span className="truncate">
          {card.from_city} → {destinationOf(card, recipient)?.city || "?"}
        </span>
      </span>
      <span className="block truncate text-xs text-ink-soft">
        <span style={{ color: sender?.color }}>{sender?.display_name ?? "?"}</span> →{" "}
        <span style={{ color: recipient?.color }}>{recipient?.display_name ?? "?"}</span> · {days}{" "}
        {days === 1 ? "day" : "days"} · {formatKm(km)}
      </span>
    </Link>
  );
}
