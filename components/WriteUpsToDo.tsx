import Link from "next/link";

/**
 * "Write-ups to do" (#67): past meetups you were at and haven't written about yet.
 * Only you see yours, and one leaves the list once you've written it. Nothing when you're
 * all caught up. `compact` is the short version for the side of the Atlas.
 */
export function WriteUpsToDo({
  todo,
  compact = false,
  className = "",
}: {
  todo: { id: string; title: string; dates: string }[];
  compact?: boolean;
  className?: string;
}) {
  if (!todo.length) return null;
  const newest = [...todo].reverse(); // the most recent first: easiest to remember
  const shown = compact ? newest.slice(0, 3) : newest;
  const rest = todo.length - shown.length;

  return (
    <section className={`card space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-ink-soft uppercase">Write-ups to do</h2>
        <span className="text-xs text-ink-soft tabular-nums">{todo.length} left</span>
      </div>
      <ul className="space-y-2">
        {shown.map((m) => (
          <li key={m.id}>
            <Link href={`/timeline/${m.id}#write-ups`} className="group flex items-center gap-2.5">
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-ink/30 text-xs text-ink-soft">
                ✎
              </span>
              <span className="min-w-0 flex-1 text-sm leading-tight">
                <span className="block font-medium break-words group-hover:underline">{m.title}</span>
                <span className="block truncate text-xs text-ink-soft">{m.dates}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-stamp group-hover:underline">Write →</span>
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="border-t border-ink/10 pt-2.5 text-xs text-ink-soft">
          <Link href="/timeline" className="font-medium text-ink hover:underline">
            And {rest} more on the timeline →
          </Link>
        </p>
      )}
    </section>
  );
}
