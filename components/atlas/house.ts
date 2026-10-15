import type { MemberWithAvatar } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";

/**
 * Home marker: a little house with the person's photo (or initial) in a round
 * window. Units are screen pixels, centred on the address.
 * Current address = filled in their colour; an old one = hollow, dashed outline.
 */
export const HOUSE_PATH = "M0,-10 L9.5,-1.5 L6.5,-1.5 L6.5,8 L-6.5,8 L-6.5,-1.5 L-9.5,-1.5 Z";
export const HOUSE_WINDOW = { cx: 0, cy: 3.2, r: 4.1 };

export const initialOf = (m: MemberWithAvatar) => (m.display_name.trim()[0] ?? "?").toUpperCase();

/** The same marker as SVG markup, for the globe's HTML pins. */
export function houseSvg(m: MemberWithAvatar, old: boolean): string {
  const { cx, cy, r } = HOUSE_WINDOW;
  const clip = `hw-${m.id}-${Math.random().toString(36).slice(2, 8)}`;
  const color = escapeHtml(m.color);
  const body = old
    ? `<path d="${HOUSE_PATH}" fill="#fffdf7" fill-opacity="0.92" stroke="${color}" stroke-width="1.6" stroke-dasharray="2.2 1.6" stroke-linejoin="round"/>`
    : `<path d="${HOUSE_PATH}" fill="${color}" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>`;
  const inner =
    !old && m.avatar_url
      ? `<clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
         <circle cx="${cx}" cy="${cy}" r="${r + 0.6}" fill="#fff"/>
         <image href="${escapeHtml(m.avatar_url)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
      : `<text x="${cx}" y="${cy + 2.4}" text-anchor="middle" font-size="6.8" font-weight="700" font-family="system-ui,sans-serif" fill="${old ? color : "#fff"}">${escapeHtml(initialOf(m))}</text>`;
  return `<svg viewBox="-11 -12 22 22" width="100%" height="100%" overflow="visible" aria-hidden="true">${body}${inner}</svg>`;
}
