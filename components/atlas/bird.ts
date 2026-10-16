import { geoContains, geoInterpolate } from "d3-geo";
import type { Country } from "@/lib/world";

/**
 * The postcard bird (a swallow seen from above, flying along +x, ~22px wingspan)
 * and the "lost in the post" marker, shared by the flat map and the globe.
 */
export const BIRD = {
  wing: "M1.6,-1 C0.4,-4.2 -1.8,-7.4 -6.4,-10.6 L-5.1,-7.9 L-6.9,-7.6 L-5.3,-5.6 L-6.9,-4.9 C-5,-3.7 -3.3,-2.4 -2.2,-1.2 Z",
  tail: "M-4,-0.6 L-9.4,-3.4 L-7.4,0 L-9.4,3.4 L-4,0.6 Z",
  body: "M4.6,0 C4.4,-1.5 3,-2.1 1.4,-2 C-0.9,-1.8 -3.2,-1.1 -5,-0.45 L-5,0.45 C-3.2,1.1 -0.9,1.8 1.4,2 C3,2.1 4.4,1.5 4.6,0 Z",
  beak: "M4.5,-0.55 L6.4,0 L4.5,0.55 Z",
};

/** How far along its route a lost card got before it vanished. */
export const LOST_AT = 0.55;

/** Where a lost card went missing: part-way along the great circle from where it was posted. */
export function lostPoint(from: [number, number], to: [number, number]): [number, number] {
  return geoInterpolate(from, to)(LOST_AT) as [number, number];
}

/** Over the sea (no country contains the point)? */
export function isWater(world: Country[] | null | undefined, lngLat: [number, number]): boolean {
  if (!world?.length) return false;
  return !world.some((f) => geoContains(f, lngLat));
}

/** The lost marker's SVG shapes (centred on 0,0): bird + red ✕ at sea, or a puzzled bird with a "?" on land. */
export function lostMarkup(color: string, water: boolean): string {
  const bird = (extra = "") =>
    `<g ${extra} stroke-linejoin="round">
      <path d="${BIRD.wing}" fill="${color}" stroke="#fff" stroke-width="0.8"/>
      <path d="${BIRD.wing}" transform="scale(1,-1)" fill="${color}" stroke="#fff" stroke-width="0.8"/>
      <path d="${BIRD.tail}" fill="${color}" stroke="#fff" stroke-width="0.7"/>
      <path d="${BIRD.body}" fill="${color}" stroke="#fff" stroke-width="0.8"/>
      <path d="${BIRD.beak}" fill="#e8a33d"/>
    </g>`;
  const inner = water
    ? `<ellipse cx="0" cy="5" rx="12" ry="3.4" fill="none" stroke="#2e5aa8" stroke-opacity="0.55" stroke-width="1.2"/>
       <ellipse cx="0" cy="5" rx="7" ry="2" fill="#2e5aa8" fill-opacity="0.18"/>
       ${bird('transform="translate(0,1) rotate(-35) scale(1.05)" opacity="0.85"')}
       <g transform="translate(9,-8)"><circle r="5" fill="#c2503a" stroke="#fff" stroke-width="1.2"/>
       <path d="M-2,-2 L2,2 M2,-2 L-2,2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>`
    : `${bird('transform="rotate(-20)"')}
       <g transform="translate(9,-9)"><circle r="5.5" fill="#fff" stroke="#2a2622" stroke-width="1"/>
       <text y="3" text-anchor="middle" font-size="8" font-weight="700" font-family="system-ui" fill="#2a2622">?</text></g>`;
  return inner;
}

/** The same marker as a whole SVG, for the globe's HTML pins. */
export function lostSvg(color: string, water: boolean): string {
  return `<svg viewBox="-16 -16 32 32" width="100%" height="100%" overflow="visible" aria-hidden="true">${lostMarkup(color, water)}</svg>`;
}
