"use client";

import { useEffect, useState } from "react";

/**
 * A country's flag colours, read from the same flag images the map's stamps use:
 * up to 3 main colours, in the order they appear across (or down) the flag —
 * Italy → green, white, red. Done in the browser, cached for the session.
 */
const cache = new Map<string, string[] | null>();
const pending = new Map<string, Promise<string[] | null>>();

const MIN_SHARE = 0.07; // ignore colours covering less of the flag than this (edges, emblems)
const MERGE_DIST = 70; // RGB distance under which two shades count as one colour
const MAX_COLOURS = 3;

function extract(img: HTMLImageElement): string[] | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Bucket pixels by coarse colour, remembering where on the flag they sit.
  type Bucket = { n: number; r: number; g: number; b: number; x: number; y: number };
  const buckets = new Map<number, Bucket>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const p = i / 4;
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, x: 0, y: 0 };
    bk.n++;
    bk.r += r;
    bk.g += g;
    bk.b += b;
    bk.x += (p % w) / w;
    bk.y += Math.floor(p / w) / h;
    buckets.set(key, bk);
    total++;
  }
  if (!total) return null;

  // Merge near shades into clusters, biggest first.
  const clusters: Bucket[] = [];
  for (const bk of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const [r, g, b] = [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n];
    const near = clusters.find((c) => Math.hypot(c.r / c.n - r, c.g / c.n - g, c.b / c.n - b) < MERGE_DIST);
    if (near) {
      near.n += bk.n;
      near.r += bk.r;
      near.g += bk.g;
      near.b += bk.b;
      near.x += bk.x;
      near.y += bk.y;
    } else clusters.push({ ...bk });
  }
  const main = clusters
    .filter((c) => c.n / total >= MIN_SHARE)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_COLOURS);
  if (!main.length) return null;

  // Order along whichever direction the stripes run.
  const xs = main.map((c) => c.x / c.n);
  const ys = main.map((c) => c.y / c.n);
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
  const axis = spread(xs) >= spread(ys) ? "x" : "y";
  main.sort((a, b) => a[axis] / a.n - b[axis] / b.n);

  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return main.map((c) => `#${hex(c.r / c.n)}${hex(c.g / c.n)}${hex(c.b / c.n)}`);
}

function load(cc: string): Promise<string[] | null> {
  if (!pending.has(cc)) {
    pending.set(
      cc,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // flagcdn allows it, so the pixels can be read
        img.onload = () => {
          let colours: string[] | null = null;
          try {
            colours = extract(img);
          } catch {}
          cache.set(cc, colours);
          resolve(colours);
        };
        img.onerror = () => {
          cache.set(cc, null);
          resolve(null);
        };
        img.src = `https://flagcdn.com/w40/${cc}.png`;
      }),
    );
  }
  return pending.get(cc)!;
}

/** Flag colours for each country code (lower-case keys); missing until loaded, or if unreadable. */
export function useFlagColors(codes: string[], enabled = true): Map<string, string[]> {
  const [, setVersion] = useState(0);
  const key = [...new Set(codes.map((c) => c.toLowerCase().replace(/[^a-z]/g, "")))].filter(Boolean).sort().join(",");
  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    const missing = key.split(",").filter((c) => !cache.has(c));
    if (missing.length)
      Promise.all(missing.map(load)).then(() => {
        if (alive) setVersion((v) => v + 1);
      });
    return () => {
      alive = false;
    };
  }, [key, enabled]);

  const out = new Map<string, string[]>();
  if (enabled && key)
    for (const c of key.split(",")) {
      const colours = cache.get(c);
      if (colours) out.set(c, colours);
    }
  return out;
}
