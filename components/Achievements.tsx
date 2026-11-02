import { AchievementSeal } from "@/components/AchievementSeal";
import type { Achievement } from "@/lib/achievements";
import { formatCount } from "@/lib/utils";

/**
 * Profile badges: earned ones as inked seals, the rest greyed with how far along they are.
 * `foldable` starts it folded shut (just the title and count), so a long list doesn't
 * push the rest of the page down. `highlight` (an achievement's id or name, from an
 * inbox message) unfolds it, scrolls to that one and plays its unlock animation. `recent` maps recently unlocked ones to
 * when: they go first, newest first, with a "New" tag.
 */
export function Achievements({
  items,
  title,
  foldable = false,
  highlight,
  recent,
}: {
  items: Achievement[];
  title: string;
  foldable?: boolean;
  highlight?: string;
  recent?: Map<string, string>;
}) {
  const earned = items.filter((a) => a.earned).length;
  // Just unlocked first (newest first), then the rest earned, then the closest to being earned.
  const unlocked = (a: Achievement) => (a.earned && recent?.get(a.id)) || "";
  const sorted = [...items].sort(
    (a, b) =>
      unlocked(b).localeCompare(unlocked(a)) ||
      Number(b.earned) - Number(a.earned) ||
      Number(!!a.secret) - Number(!!b.secret) ||
      share(b) - share(a),
  );

  const count = (
    <span className="font-mono text-sm text-ink-soft tabular-nums">
      {earned} / {items.length}
    </span>
  );

  const list = (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((a) => {
        const hidden = a.secret && !a.earned;
        const lit = !!highlight && (a.id === highlight || a.name === highlight);
        return (
          <li
            key={a.id}
            id={lit ? "unlocked" : undefined}
            className={`flex items-start gap-3 rounded-2xl border p-3 ${
              a.earned ? "border-stamp/30 bg-white" : "border-dashed border-ink/15 bg-white/40"
            } ${lit ? "achievement-unlock scroll-mt-40 ring-2 ring-stamp ring-offset-2 ring-offset-paper" : ""}`}
            title={a.description}
          >
            <AchievementSeal id={a.id} earned={a.earned} hidden={hidden} />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold leading-tight ${a.earned ? "" : "text-ink-soft"}`}>
                {hidden ? "???" : a.name}
              </span>
              <span className="block text-xs leading-snug text-ink-soft">{a.description}</span>
              {!a.earned && a.progress && (
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <span
                      className="block h-full rounded-full bg-stamp/70"
                      style={{ width: `${Math.round(share(a) * 100)}%` }}
                    />
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-soft tabular-nums">
                    {formatCount(a.progress.have)}/{formatCount(a.progress.need)}
                  </span>
                </span>
              )}
              {a.earned && (
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-stamp">
                  Earned ✓
                  {unlocked(a) && <span className="rounded-full bg-stamp px-1.5 text-[10px] font-bold text-white uppercase">New</span>}
                </span>
              )}
            </span>
          </li>
          );
        })}
      </ul>
  );

  if (foldable)
    return (
      <details id="achievements" className="group scroll-mt-24 space-y-3" open={!!highlight}>
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <span className="flex items-baseline gap-3">
            {count}
            <span className="text-sm font-medium text-ink-soft group-open:hidden">Show ▾</span>
            <span className="hidden text-sm font-medium text-ink-soft group-open:inline">Hide ▴</span>
          </span>
        </summary>
        {list}
      </details>
    );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {count}
      </div>
      {list}
    </section>
  );
}

function share(a: Achievement): number {
  if (a.earned) return 1;
  return a.progress ? a.progress.have / a.progress.need : 0;
}
