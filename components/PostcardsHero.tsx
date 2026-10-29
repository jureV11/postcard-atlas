import Link from "next/link";
import { Flag } from "@/components/Flag";
import { formatKm } from "@/lib/geo";
import { EARTH_KM } from "@/lib/passport";
import type { GroupStats, TimedCard } from "@/lib/stats";
import { destinationOf, type MemberWithAvatar } from "@/lib/types";

/**
 * Top of the Postcards tab: an envelope-like banner with the two things you
 * come here to do, then the group's numbers as ticket stubs and the fastest /
 * slowest cards as luggage tags. Delivered, public cards only.
 */
export function PostcardsHero({
  stats,
  countries,
  membersById,
}: {
  stats: GroupStats;
  countries: number;
  membersById: Map<string, MemberWithAvatar>;
}) {
  const laps = stats.totalKm / EARTH_KM;
  const avg = stats.avgDays === null ? null : stats.avgDays.toFixed(stats.avgDays < 10 ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* The envelope */}
      <section className="overflow-hidden rounded-[8px] bg-ink text-paper shadow-[0_18px_36px_-20px_rgb(42_38_34/0.7)]">
        <div className="relative flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
          {/* Envelope flap lines, very faint */}
          <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.07]" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M0 0 L50 55 L100 0" fill="none" stroke="currentColor" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="relative">
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Postcards</h1>
            <p className="mt-1 font-hand text-2xl leading-tight text-paper/75">
              {stats.delivered} delivered{countries > 0 && ` from ${countries} ${countries === 1 ? "country" : "countries"}`}
            </p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <Link
              href="/postcards/new"
              className="inline-flex min-h-12 items-center gap-2 rounded-[4px] bg-stamp px-5 font-semibold text-white outline-2 outline-offset-[-6px] outline-dashed outline-white/45 transition hover:-translate-y-0.5 hover:bg-[#cf5b44] active:translate-y-0"
            >
              <span aria-hidden="true" className="text-xl leading-none">＋</span> Log a postcard
            </Link>
            <Link
              href="/postcards/arrived"
              className="inline-flex min-h-12 items-center gap-2 rounded-[4px] bg-paper px-5 font-semibold text-ink outline-2 outline-offset-[-6px] outline-dashed outline-ink/25 transition hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
            >
              <span aria-hidden="true">✉</span> A postcard arrived!
            </Link>
          </div>
        </div>
        <div className="airmail-strip" aria-hidden="true" />
      </section>

      {/* The numbers, as ticket stubs */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ticket label="Delivered" value={stats.delivered.toLocaleString("en")} note="postcards" />
        <Ticket
          label="Travelled"
          value={Math.round(stats.totalKm).toLocaleString("en")}
          unit="km"
          note={
            stats.delivered
              ? `≈ ${Math.round(stats.totalKm / stats.delivered).toLocaleString("en")} km per card`
              : laps >= 0.05
                ? `${laps.toFixed(laps < 10 ? 1 : 0)}× around the Earth`
                : "and counting"
          }
        />
        <Ticket label="In the post" value={avg ?? "—"} unit={avg ? "days" : undefined} note="on average" />
        <Ticket label="Countries" value={String(countries)} note="sent from" />
      </dl>

      {(stats.fastest || stats.slowest) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.fastest && <LuggageTag title="Fastest" entry={stats.fastest} membersById={membersById} />}
          {stats.slowest && <LuggageTag title="Slowest" entry={stats.slowest} membersById={membersById} />}
        </div>
      )}
    </div>
  );
}

/** A ticket stub: notched sides, a perforation line, a big monospace number. */
function Ticket({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <div className="ticket relative bg-[#fffdf8] px-5 py-4 shadow-[0_1px_2px_rgb(42_38_34/0.08)]">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">{label}</dt>
      <dd className="mt-1.5 font-mono text-2xl font-bold leading-none tabular-nums sm:text-3xl">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-ink-soft">{unit}</span>}
      </dd>
      <dd className="mt-2 border-t border-dashed border-ink/20 pt-1.5 text-xs text-ink-soft">{note}</dd>
    </div>
  );
}

/** Fastest / slowest card as a luggage tag with a punched hole. */
function LuggageTag({ title, entry, membersById }: { title: string; entry: TimedCard; membersById: Map<string, MemberWithAvatar> }) {
  const { card, km, days, kmPerDay } = entry;
  const sender = membersById.get(card.sender_id);
  const recipient = membersById.get(card.recipient_id);
  return (
    <Link
      href={`/postcards/${card.id}`}
      className="luggage-tag group relative flex items-center gap-4 bg-[#f4e3c8] py-3 pl-12 pr-4 transition hover:-translate-y-0.5"
    >
      <span aria-hidden="true" className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-paper shadow-[inset_0_1px_2px_rgb(42_38_34/0.35)] ring-2 ring-[#d9c29c]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">{title}</span>
        <span className="flex items-center gap-1.5 truncate font-hand text-[1.4rem] leading-tight group-hover:text-stamp">
          <Flag code={card.from_country_code} size={14} />
          {card.from_city} → {destinationOf(card, recipient)?.city || "?"}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          <span style={{ color: sender?.color }}>{sender?.display_name ?? "?"}</span> →{" "}
          <span style={{ color: recipient?.color }}>{recipient?.display_name ?? "?"}</span> · {days}{" "}
          {days === 1 ? "day" : "days"} · {formatKm(km)}
        </span>
      </span>
      <span className="shrink-0 text-right font-mono text-sm font-bold tabular-nums">
        {Math.round(kmPerDay).toLocaleString("en")}
        <span className="block text-[10px] font-normal text-ink-soft">km/day</span>
      </span>
    </Link>
  );
}
