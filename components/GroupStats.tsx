import Link from "next/link";
import { Flag } from "@/components/Flag";
import { formatKm } from "@/lib/geo";
import type { GroupStats as Stats, TimedCard } from "@/lib/stats";
import type { MemberWithAvatar } from "@/lib/types";

/** "Group stats" block at the top of the Postcards tab. */
export function GroupStats({ stats, membersById }: { stats: Stats; membersById: Map<string, MemberWithAvatar> }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Group stats</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Postcards delivered" value={stats.delivered.toLocaleString("en")} />
        <Tile label="Km travelled, combined" value={Math.round(stats.totalKm).toLocaleString("en")} unit="km" />
        <Tile
          label="Average delivery"
          value={stats.avgDays === null ? "—" : stats.avgDays.toFixed(stats.avgDays < 10 ? 1 : 0)}
          unit={stats.avgDays === null ? undefined : "days"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {(stats.fastest || stats.slowest) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.fastest && <PaceCard title="Fastest card" entry={stats.fastest} membersById={membersById} />}
          {stats.slowest && <PaceCard title="Slowest card" entry={stats.slowest} membersById={membersById} />}
        </div>
      )}

      <p className="text-xs text-ink-soft">
        Counts delivered postcards only — cards still on their way stay a surprise.
      </p>
    </section>
  );
}

function Tile({ label, value, unit, className = "" }: { label: string; value: string; unit?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-ink/10 bg-white/75 p-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-ink-soft">{unit}</span>}
      </p>
    </div>
  );
}

function PaceCard({
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
    <Link
      href={`/postcards/${card.id}`}
      className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/75 p-4 transition hover:bg-white"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep">
        <Flag code={card.from_country_code} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-ink-soft">{title}</span>
        <span className="block truncate font-medium">
          {card.from_city} → {recipient?.home_city ?? "?"}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          <span style={{ color: sender?.color }}>{sender?.display_name ?? "?"}</span> →{" "}
          <span style={{ color: recipient?.color }}>{recipient?.display_name ?? "?"}</span>
        </span>
        <span className="mt-1 block text-sm tabular-nums">
          {days} {days === 1 ? "day" : "days"} · {formatKm(km)} ·{" "}
          <strong>{Math.round(kmPerDay).toLocaleString("en")} km/day</strong>
        </span>
      </span>
    </Link>
  );
}
