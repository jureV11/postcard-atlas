"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Retro "Greetings from …" large-letter postcards, scattered on the table and
 * tilting gently towards the pointer. Drawn in CSS (no images). Purely
 * decorative: hidden from screen readers, still under reduced motion.
 */
const CARDS = [
  { city: "Kyoto", sky: ["#f7b5a0", "#e2766a"], ink: "#7c1d22", fill: ["#ffe2c4", "#f2a65a"], pos: "left-[2%] top-[8%]", rot: -9, depth: 1.2 },
  { city: "Reykjavík", sky: ["#bfe0ef", "#5a96c4"], ink: "#123b5e", fill: ["#fffbe8", "#ffd166"], pos: "right-[1%] top-[16%]", rot: 7, depth: 0.8 },
  { city: "Marrakesh", sky: ["#ffd7a8", "#e98a3e"], ink: "#5b2a12", fill: ["#fff3d6", "#f4c46b"], pos: "left-[6%] bottom-[6%]", rot: 5, depth: 1 },
  { city: "Ljubljana", sky: ["#cfe8c9", "#6aa968"], ink: "#1f4a2b", fill: ["#fffbe8", "#9fd38a"], pos: "right-[5%] bottom-[10%]", rot: -6, depth: 1.4 },
];

/** 1 for short names, smaller for long ones (MARRAKESH, LJUBLJANA…). */
const fit = (name: string) => Math.min(1, 7.5 / name.length);

export function GreetingsCards() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden [--px:0] [--py:0] [perspective:1200px]">
      {CARDS.map((c, i) => (
        <div
          key={c.city}
          className={`greet-card absolute hidden w-[min(34vw,300px)] md:block ${c.pos}`}
          style={
            {
              "--rot": `${c.rot}deg`,
              "--depth": c.depth,
              animationDelay: `${120 + i * 110}ms`,
            } as CSSProperties
          }
        >
          <div
            className="aspect-[3/2] rounded-[4px] bg-white p-2 shadow-[0_2px_4px_rgb(42_38_34/0.12),0_24px_48px_-20px_rgb(42_38_34/0.55)]"
            style={{ background: "#fffdf7" }}
          >
            <div
              className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-[2px]"
              style={{ background: `linear-gradient(170deg, ${c.sky[0]}, ${c.sky[1]})` }}
            >
              {/* A low sun and hills, for that 1950s card feel */}
              <span className="absolute left-1/2 top-[18%] size-[38%] -translate-x-1/2 rounded-full bg-white/35" />
              <span
                className="absolute inset-x-[-10%] bottom-[-30%] h-[60%] rounded-[50%]"
                style={{ background: c.ink, opacity: 0.18 }}
              />
              <span className="relative font-hand text-[clamp(14px,1.6vw,20px)] leading-none" style={{ color: c.ink }}>
                Greetings from
              </span>
              <span
                className="relative mt-0.5 font-display font-black uppercase leading-none tracking-tight"
                style={{
                  // Long names get smaller letters so they always fit the card
                  fontSize: `clamp(${Math.round(26 * fit(c.city))}px, ${(3.6 * fit(c.city)).toFixed(2)}vw, ${Math.round(46 * fit(c.city))}px)`,
                  backgroundImage: `linear-gradient(180deg, ${c.fill[0]}, ${c.fill[1]})`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextStroke: `1.5px ${c.ink}`,
                  filter: `drop-shadow(2px 3px 0 ${c.ink})`,
                }}
              >
                {c.city}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
