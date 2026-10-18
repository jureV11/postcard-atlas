"use client";

/** "Date received", with a way out when nobody remembers (#4). */
export function ArrivalDateField({
  value,
  onChange,
  unknown,
  onUnknownChange,
  min,
  max,
}: {
  value: string;
  onChange: (date: string) => void;
  unknown: boolean;
  onUnknownChange: (unknown: boolean) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor="receivedOn">
        Date received
      </label>
      <input
        id="receivedOn"
        type="date"
        className="input disabled:opacity-50"
        min={min}
        max={max}
        value={unknown ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={unknown}
        required={!unknown}
      />
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={unknown} onChange={(e) => onUnknownChange(e.target.checked)} />
        <span>
          I don&apos;t know when it arrived
          <span className="block text-xs text-ink-soft">
            It still counts as delivered — it&apos;s just left out of the delivery-time stats and the replay.
          </span>
        </span>
      </label>
    </div>
  );
}
