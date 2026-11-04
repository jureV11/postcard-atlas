"use client";

import { useEffect, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Parts = { d: string; m: string; y: string };
const split = (v: string): Parts => {
  const [y = "", m = "", d = ""] = v ? v.split("-") : [];
  return { d: d.replace(/^0/, ""), m: m.replace(/^0/, ""), y };
};
const join = ({ d, m, y }: Parts) => (d && m && y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "");
const daysIn = (m: string, y: string) => (m ? new Date(Date.UTC(Number(y) || 2000, Number(m), 0)).getUTCDate() : 31);

/**
 * A date as three dropdowns, day / month / year, the same on every phone. The
 * phones' own date pickers vary, and on iPhones one easily flips to a month and
 * year wheel with no days (#35). `value` is "YYYY-MM-DD", or "" until all three
 * are chosen. `clearable` adds a way to empty it again.
 */
export function DateField({
  id,
  value,
  onChange,
  clearable = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}) {
  const [parts, setParts] = useState(() => split(value));
  // Follow a date set from outside; a half-chosen one is sent up as "", so leave that be
  useEffect(() => {
    if (value && value !== join(parts)) setParts(split(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear + 3 - 1990 }, (_, i) => String(thisYear + 2 - i));
  if (parts.y && !years.includes(parts.y)) years.push(parts.y);
  const days = daysIn(parts.m, parts.y);

  function set(key: keyof Parts, v: string) {
    const next = { ...parts, [key]: v };
    if (Number(next.d) > daysIn(next.m, next.y)) next.d = String(daysIn(next.m, next.y)); // 31 Mar → Apr: 30 Apr
    setParts(next);
    onChange(join(next));
  }

  return (
    <div className="flex items-center gap-2">
      <select id={id} className="input w-[4.75rem] shrink-0 px-2.5" value={parts.d} onChange={(e) => set("d", e.target.value)} aria-label="Day">
        <option value="">Day</option>
        {Array.from({ length: days }, (_, i) => (
          <option key={i} value={String(i + 1)}>
            {i + 1}
          </option>
        ))}
      </select>
      <select className="input min-w-0 flex-1 px-2.5" value={parts.m} onChange={(e) => set("m", e.target.value)} aria-label="Month">
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select className="input w-[5.5rem] shrink-0 px-2.5" value={parts.y} onChange={(e) => set("y", e.target.value)} aria-label="Year">
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      {clearable && (parts.d || parts.m || parts.y) && (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink"
          aria-label="Clear the date"
          onClick={() => {
            setParts({ d: "", m: "", y: "" });
            onChange("");
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
