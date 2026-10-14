export function StatTile({
  label,
  value,
  hint,
  primary,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  primary?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${primary ? "border-ink bg-ink text-paper" : "border-ink/10 bg-white/75"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${primary ? "text-paper/70" : "text-ink-soft"}`}>{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${primary ? "text-paper/70" : "text-ink-soft"}`}>{hint}</p>}
    </div>
  );
}
