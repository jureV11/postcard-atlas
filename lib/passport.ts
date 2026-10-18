import { cityKey } from "@/lib/atlas";
import { cardKm } from "@/lib/stats";
import { isLocated, type LocatedPostcard, type Member, type Postcard } from "@/lib/types";

/** Once around the Earth at the equator, and to the Moon and back (average distance, twice). */
export const EARTH_KM = 40_075;
export const MOON_KM = 384_400;
export const MOON_AND_BACK_KM = 2 * MOON_KM;

export type Journey = { card: LocatedPostcard; km: number; toCity: string };
export type MonthBar = { key: string; label: string; year: number; count: number };
export type PenPals = { a: string; b: string; aToB: number; bToA: number; total: number };

export type Passport = {
  delivered: number;
  totalKm: number;
  countries: number;
  towns: number;
  avgDays: number | null;
  members: number;
  longest: Journey | null;
  shortest: Journey | null;
  /** Cards delivered in each of the last 12 months, oldest first. */
  months: MonthBar[];
  /** Pairs of friends by cards swapped, most first. */
  penPals: PenPals[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The group's "passport" for the leaderboard. Delivered, public cards only — the
 * same cards every other stat counts, so nothing hints at a surprise.
 */
export function groupPassport(cards: Postcard[], members: Member[], today = new Date()): Passport {
  const byId = new Map(members.map((m) => [m.id, m]));
  const delivered = cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

  let totalKm = 0;
  let longest: Journey | null = null;
  let shortest: Journey | null = null;
  const days: number[] = [];
  for (const card of delivered) {
    const recipient = byId.get(card.recipient_id);
    const km = cardKm(card, recipient);
    totalKm += km;
    const toCity = card.to_city ?? recipient?.home_city ?? "";
    if (!longest || km > longest.km) longest = { card, km, toCity };
    if (km >= 1 && (!shortest || km < shortest.km)) shortest = { card, km, toCity };
    if (card.received_on)
      days.push(Math.max(1, Math.round((Date.parse(card.received_on) - Date.parse(card.sent_on)) / 86_400_000)));
  }

  // Last 12 months by arrival, ending with this month.
  const months: MonthBar[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), count: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const c of delivered) {
    const i = c.received_on ? monthIndex.get(c.received_on.slice(0, 7)) : undefined;
    if (i !== undefined) months[i].count++;
  }

  // Pen pals: unordered pairs, counting both directions.
  const pairs = new Map<string, PenPals>();
  for (const c of delivered) {
    const [a, b] = [c.sender_id, c.recipient_id].sort();
    const key = `${a}|${b}`;
    const p = pairs.get(key) ?? { a, b, aToB: 0, bToA: 0, total: 0 };
    if (c.sender_id === a) p.aToB++;
    else p.bToA++;
    p.total++;
    pairs.set(key, p);
  }

  return {
    delivered: delivered.length,
    totalKm,
    countries: new Set(delivered.map((c) => c.from_country_code)).size,
    towns: new Set(delivered.map(cityKey)).size,
    avgDays: days.length ? days.reduce((t, d) => t + d, 0) / days.length : null,
    members: members.filter((m) => !m.left_at).length, // current members
    longest,
    shortest: shortest && longest && shortest.card.id !== longest.card.id ? shortest : null,
    months,
    penPals: [...pairs.values()].sort((x, y) => y.total - x.total).slice(0, 5),
  };
}
