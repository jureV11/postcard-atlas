"use client";

/** "Hand delivered": the card was given in person instead of posted (#10). */
export function HandDeliveredField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Hand delivered
        <span className="block text-xs text-ink-soft">
          Given in person instead of posted. It still counts — just not in the time-in-the-post stats.
        </span>
      </span>
    </label>
  );
}
