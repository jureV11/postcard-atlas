"use client";

import { useEffect, useRef, useState } from "react";
import { AchievementSeal } from "@/components/AchievementSeal";

const SEAL = 28; // px, each seal
const GAP = 2; // px between seals
const MORE = 30; // px kept free for the "+N" at the end

/**
 * A row of earned seals that uses all the room it has (#71): as many as fit, then
 * "+N" for the rest, never clipped. Rarest first, so the ones that fit are the best.
 */
export function SealRow({ seals }: { seals: { id: string; title: string }[] }) {
  const row = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(Math.min(seals.length, 5)); // what used to show, until the row is measured

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const all = seals.length * (SEAL + GAP) - GAP;
      setFit(all <= width ? seals.length : Math.max(1, Math.floor((width - MORE + GAP) / (SEAL + GAP))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [seals.length]);

  const rest = seals.length - fit;
  return (
    <span ref={row} className="mt-0.5 flex w-full items-center gap-0.5 overflow-hidden [&_svg]:size-7">
      {seals.slice(0, fit).map((s) => (
        <span key={s.id} title={s.title} className="shrink-0">
          <AchievementSeal id={s.id} earned />
        </span>
      ))}
      {rest > 0 && <span className="ml-1 shrink-0 text-xs text-ink-soft tabular-nums">+{rest}</span>}
    </span>
  );
}
