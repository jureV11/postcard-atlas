import { cityKey } from "@/lib/atlas";
import { haversineKm } from "@/lib/geo";
import { destinationOf, isLocated, type LocatedPostcard, type Member, type Postcard } from "@/lib/types";

export type CountryTally = { code: string; name: string; count: number };

export type MemberStats = {
  memberId: string;
  sent: Postcard[]; // everything they've sent, including mystery cards in transit
  arrived: LocatedPostcard[]; // sent and received — the ones that count
  inTransit: number; // sent, still on the way
  received: Postcard[]; // cards they've received
  incoming: number; // on their way to this member
  countries: CountryTally[]; // countries sent from, most cards first
  postcardKm: number;
  explorerKm: number;
  farthest: { card: LocatedPostcard; km: number } | null;
  mostRecent: LocatedPostcard | null;
};

/** Distance a card travelled: sent-from city → the address it was sent to. */
export function cardKm(card: LocatedPostcard, recipient: Member | undefined): number {
  const to = destinationOf(card, recipient);
  return to ? haversineKm(card.from_lat, card.from_lng, to.lat, to.lng) : 0;
}

const newestFirst = (a: Postcard, b: Postcard) =>
  b.sent_on.localeCompare(a.sent_on) || b.created_at.localeCompare(a.created_at);

/**
 * Per-member stats. Only cards that have arrived count towards countries and
 * km — in-transit cards are a mystery (and everyone sees the same leaderboard).
 */
export function computeStats(members: Member[], cards: Postcard[]): Map<string, MemberStats> {
  const byId = new Map(members.map((m) => [m.id, m]));
  const result = new Map<string, MemberStats>();

  for (const m of members) {
    const sent = cards.filter((c) => c.sender_id === m.id).sort(newestFirst);
    // Public only: a card the viewer can see early (as its recipient) must not
    // change the leaderboard before everyone else can see it too.
    const arrived = sent.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

    // Countries sent from
    const tally = new Map<string, CountryTally>();
    for (const c of arrived) {
      const t = tally.get(c.from_country_code) ?? { code: c.from_country_code, name: c.from_country, count: 0 };
      t.count++;
      tally.set(c.from_country_code, t);
    }

    // Postcard km + farthest card
    let postcardKm = 0;
    let farthest: MemberStats["farthest"] = null;
    for (const c of arrived) {
      const km = cardKm(c, byId.get(c.recipient_id));
      postcardKm += km;
      if (!farthest || km > farthest.km) farthest = { card: c, km };
    }

    // Explorer km: home → each unique sent-from city, counted once
    const cities = new Map<string, LocatedPostcard>();
    for (const c of arrived) if (!cities.has(cityKey(c))) cities.set(cityKey(c), c);
    let explorerKm = 0;
    for (const c of cities.values()) explorerKm += haversineKm(m.home_lat, m.home_lng, c.from_lat, c.from_lng);

    result.set(m.id, {
      memberId: m.id,
      sent,
      arrived,
      inTransit: sent.length - sent.filter((c) => c.status === "received").length,
      received: cards.filter((c) => c.recipient_id === m.id && c.status === "received"),
      incoming: cards.filter((c) => c.recipient_id === m.id && c.status === "in_transit").length,
      countries: [...tally.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      postcardKm,
      explorerKm,
      farthest,
      mostRecent: arrived[0] ?? null,
    });
  }

  return result;
}

/** Leaderboard order: countries sent from, then postcard km, then cards sent. */
export function rankMembers<T extends Member>(members: T[], stats: Map<string, MemberStats>) {
  const rows = members.map((m) => ({ member: m, stats: stats.get(m.id)! }));
  rows.sort(
    (a, b) =>
      b.stats.countries.length - a.stats.countries.length ||
      b.stats.postcardKm - a.stats.postcardKm ||
      b.stats.arrived.length - a.stats.arrived.length,
  );
  // Shared rank for exact ties ("1, 2, 2, 4")
  let rank = 0;
  return rows.map((row, i) => {
    const prev = rows[i - 1];
    const tied =
      prev &&
      prev.stats.countries.length === row.stats.countries.length &&
      Math.round(prev.stats.postcardKm) === Math.round(row.stats.postcardKm) &&
      prev.stats.arrived.length === row.stats.arrived.length;
    if (!tied) rank = i + 1;
    return { ...row, rank };
  });
}

export type TimedCard = { card: LocatedPostcard; km: number; days: number; kmPerDay: number };

export type GroupStats = {
  delivered: number;
  totalKm: number;
  avgDays: number | null;
  fastest: TimedCard | null;
  slowest: TimedCard | null;
};

/**
 * Whole-group totals for the Postcards tab. Delivered, public cards only — no
 * cards in transit, and none held back until the rest of their trip arrives, so
 * these numbers never hint at a surprise.
 */
export function groupStats(cards: Postcard[], members: Member[]): GroupStats {
  const byId = new Map(members.map((m) => [m.id, m]));
  const delivered = cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

  let totalKm = 0;
  const timed: TimedCard[] = [];
  for (const card of delivered) {
    const km = cardKm(card, byId.get(card.recipient_id));
    totalKm += km;
    if (!card.received_on) continue; // timing stats skip cards missing a date
    // A card that arrived the same day it was posted counts as 1 day.
    const days = Math.max(1, Math.round((Date.parse(card.received_on) - Date.parse(card.sent_on)) / 86_400_000));
    timed.push({ card, km, days, kmPerDay: km / days });
  }

  const byPace = [...timed].sort((a, b) => b.kmPerDay - a.kmPerDay);
  return {
    delivered: delivered.length,
    totalKm,
    avgDays: timed.length ? timed.reduce((t, c) => t + c.days, 0) / timed.length : null,
    fastest: byPace[0] ?? null,
    slowest: byPace.length > 1 ? byPace[byPace.length - 1] : null,
  };
}

/** Distinct countries anyone in the group has sent an arrived card from. */
export function groupCountries(cards: Postcard[]): CountryTally[] {
  const tally = new Map<string, CountryTally>();
  for (const c of cards) {
    if (c.status !== "received" || !c.is_public || !isLocated(c)) continue;
    const t = tally.get(c.from_country_code) ?? { code: c.from_country_code, name: c.from_country, count: 0 };
    t.count++;
    tally.set(c.from_country_code, t);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
