import type { Achievement } from "@/lib/achievements";

/** Profile badges: earned ones as inked seals, the rest greyed with how far along they are. */
export function Achievements({ items, title }: { items: Achievement[]; title: string }) {
  const earned = items.filter((a) => a.earned).length;
  // Earned first, then the closest to being earned.
  const sorted = [...items].sort(
    (a, b) =>
      Number(b.earned) - Number(a.earned) ||
      Number(!!a.secret) - Number(!!b.secret) ||
      share(b) - share(a),
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <span className="font-mono text-sm text-ink-soft tabular-nums">
          {earned} / {items.length}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((a) => {
          const hidden = a.secret && !a.earned;
          return (
            <li
              key={a.id}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${
                a.earned ? "border-stamp/30 bg-white" : "border-dashed border-ink/15 bg-white/40"
              }`}
              title={a.description}
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full text-2xl ${
                  a.earned
                    ? "bg-stamp/10 shadow-[inset_0_0_0_2px_rgb(194_80_58/0.55),inset_0_0_0_4px_#fff,inset_0_0_0_5px_rgb(194_80_58/0.3)]"
                    : "bg-ink/5 opacity-50 grayscale"
                }`}
                aria-hidden="true"
              >
                {hidden ? "？" : a.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${a.earned ? "" : "text-ink-soft"}`}>
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
                      {a.progress.have.toLocaleString("en")}/{a.progress.need.toLocaleString("en")}
                    </span>
                  </span>
                )}
                {a.earned && <span className="mt-1 block text-[11px] font-medium text-stamp">Earned ✓</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function share(a: Achievement): number {
  if (a.earned) return 1;
  return a.progress ? a.progress.have / a.progress.need : 0;
}
