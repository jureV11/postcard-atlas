"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A small hand-rolled confetti burst: flags and paper bits fly up from a point
// and drift down. Drawn as DOM elements on <body>, so it keeps playing across a
// page change (e.g. after logging a postcard). Skipped with "reduce motion".

const PAPER = ["#c2503a", "#e9c48c", "#2e86ab", "#3b8b5a", "#d1495b", "#f6f0e4", "#7b5ea7"];

/** Rainbow pride flag, drawn here so it needs no image download. */
const PRIDE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 4" preserveAspectRatio="none">${[
      "#e40303",
      "#ff8c00",
      "#ffed00",
      "#008026",
      "#004dff",
      "#750787",
    ]
      .map((c, i) => `<rect y="${(i * 4) / 6}" width="6" height="${4 / 6 + 0.01}" fill="${c}"/>`)
      .join("")}</svg>`,
  );

export const flagUrl = (countryCode: string) =>
  `https://flagcdn.com/w40/${countryCode.toLowerCase().replace(/[^a-z]/g, "")}.png`;

/** The profile flag: their home country's, or a special flag for configured names. */
export function profileFlag(name: string, countryCode: string): string {
  return flagUrl(countryCode);
}

type Burst = {
  /** Where it bursts from, in viewport pixels (defaults to the top middle of the screen). */
  x?: number;
  y?: number;
  /** Flag image URLs to throw. */
  flags?: string[];
  flagCount?: number;
  /** Plain paper confetti pieces. */
  paperCount?: number;
};

export function confetti({ x, y, flags = [], flagCount = 22, paperCount = 0 }: Burst = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ox = x ?? window.innerWidth / 2;
  const oy = y ?? window.innerHeight * 0.3;
  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "60", overflow: "hidden" });
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  type Piece = { el: HTMLElement; x: number; y: number; vx: number; vy: number; rot: number; vr: number; spin: number };
  const pieces: Piece[] = [];
  const add = (el: HTMLElement, speed: number) => {
    Object.assign(el.style, { position: "absolute", left: "0", top: "0", willChange: "transform, opacity" });
    layer.append(el);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9; // mostly upward
    const v = speed * (0.55 + Math.random() * 0.6);
    pieces.push({
      el,
      x: ox,
      y: oy,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 540,
      spin: Math.random() * Math.PI * 2,
    });
  };

  for (let i = 0; flags.length && i < flagCount; i++) {
    const img = document.createElement("img");
    img.src = flags[i % flags.length];
    img.alt = "";
    const w = 20 + Math.random() * 10;
    Object.assign(img.style, {
      width: `${w}px`,
      height: `${w * 0.68}px`,
      objectFit: "cover",
      borderRadius: "2px",
      boxShadow: "0 1px 2px rgba(42,38,34,.3)",
    });
    add(img, 820);
  }
  for (let i = 0; i < paperCount; i++) {
    const bit = document.createElement("span");
    Object.assign(bit.style, {
      width: `${6 + Math.random() * 5}px`,
      height: `${3 + Math.random() * 4}px`,
      background: PAPER[i % PAPER.length],
      borderRadius: "1px",
    });
    add(bit, 900);
  }

  const GRAVITY = 900; // px/s²
  const DRAG = 1.6; // air resistance, per second
  const LIFE = 2.8; // seconds
  let last = performance.now();
  const start = last;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const age = (now - start) / 1000;
    for (const p of pieces) {
      p.vx -= p.vx * DRAG * dt;
      p.vy += (GRAVITY - p.vy * DRAG) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.spin += dt * 6;
      // Flutter: squash one way as the piece tumbles.
      const flip = Math.cos(p.spin);
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scaleY(${flip})`;
      p.el.style.opacity = String(Math.max(0, Math.min(1, (LIFE - age) / 0.6)));
    }
    if (age < LIFE) requestAnimationFrame(frame);
    else layer.remove();
  };
  requestAnimationFrame(frame);
}

/** Bursts flags from its own spot when the page opens, and again when tapped. */
export function FlagBurst({ flag, label, children }: { flag: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const fire = () => {
    const r = ref.current?.getBoundingClientRect();
    confetti({ x: r ? r.left + r.width / 2 : undefined, y: r ? r.top + r.height / 2 : undefined, flags: [flag] });
  };
  useEffect(() => {
    const t = setTimeout(fire, 250); // once the page has settled
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
  return (
    <button ref={ref} type="button" onClick={fire} aria-label={label} className="shrink-0 rounded-full">
      {children}
    </button>
  );
}
