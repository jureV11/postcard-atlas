"use client";

import { addDays } from "@/lib/dates";

const GIVE_UP_AFTER = 100; // days — the one-tap suggestion

/** "Gave up on" for a lost postcard: any day from when it was sent until today. */
export function LostDateField({
  value,
  onChange,
  sentOn,
  today,
  id = "lostOn",
}: {
  value: string;
  onChange: (date: string) => void;
  sentOn: string;
  today: string;
  id?: string;
}) {
  const suggested = addDays(sentOn, GIVE_UP_AFTER);
  const canSuggest = suggested <= today;
  return (
    <div>
      <label className="label" htmlFor={id}>
        Gave up on
      </label>
      <input
        id={id}
        type="date"
        className="input"
        min={sentOn}
        max={today}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      {canSuggest && value !== suggested && (
        <button type="button" onClick={() => onChange(suggested)} className="mt-1.5 text-sm font-medium text-stamp hover:underline">
          Use {GIVE_UP_AFTER} days after it was sent
        </button>
      )}
    </div>
  );
}
