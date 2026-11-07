import { daysBetween } from "@/lib/dates";
import { meetupPlaces } from "@/lib/meetups";
import { cardKm, computeStats, groupStats, type CountryTally } from "@/lib/stats";
import { isLocated, type LocatedPostcard, type Meetup, type MeetupStop, type Member, type Postcard } from "@/lib/types";

export type ReviewMeetup = Pick<Meetup, "id" | "title" | "starts_on" | "ends_on" | "city" | "country" | "country_code" | "lat" | "lng" | "stops"> & {
  memberIds: string[];
};

/**
 * Only cards everyone can see count: arrived and public, the same ones as the
 * leaderboard. Nothing still in the post, and nothing held back until the rest
 * of its trip arrives, so the review is the same for everyone and spoils nothing.
 */
const counted = (cards: Postcard[]) => cards.filter((c) => c.status === "received" && c.is_public).filter(isLocated);

/**
 * The year the review opens on: this one, except all through January, when
 * the year that just ended is what everyone wants to look back on.
 */
export function defaultReviewYear(now = new Date()): number {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Years with something to look back on, newest first (always including `thisYear`). */
export function reviewYears(cards: Postcard[], meetups: ReviewMeetup[], thisYear: number): number[] {
  const years = new Set<number>([thisYear]);
  for (const c of counted(cards)) years.add(Number(c.sent_on.slice(0, 4)));
  for (const m of meetups) years.add(Number(m.starts_on.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export function yearReview<T extends Member>(year: number, allCards: Postcard[], members: T[], allMeetups: ReviewMeetup[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const everyCard = counted(allCards);
  const cards = everyCard.filter((c) => c.sent_on.startsWith(`${year}-`));

  // Countries: all of this year's, and the ones nobody had sent a card from before
  const tally = new Map<string, CountryTally>();
  for (const c of cards) {
    const t = tally.get(c.from_country_code) ?? { code: c.from_country_code, name: c.from_country, count: 0 };
    t.count++;
    tally.set(c.from_country_code, t);
  }
  const countries = [...tally.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const before = new Set(everyCard.filter((c) => c.sent_on < `${year}-01-01`).map((c) => c.from_country_code));
  const newCountries = countries.filter((c) => !before.has(c.code));

  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const c of cards) byMonth[Number(c.sent_on.slice(5, 7)) - 1]++;
  const busiest = Math.max(...byMonth) > 0 ? byMonth.indexOf(Math.max(...byMonth)) : null;

  let farthest: { card: LocatedPostcard; km: number } | null = null;
  for (const c of cards) {
    const km = cardKm(c, byId.get(c.recipient_id));
    if (!farthest || km > farthest.km) farthest = { card: c, km };
  }
  const timing = groupStats(cards, members);

  // Everyone's year, with the year's cards only
  const stats = computeStats(members, cards);
  const people = members
    .map((m) => {
      const s = stats.get(m.id)!;
      return { member: m, sent: s.arrived.length, received: s.received.length, countries: s.countries.length, km: s.postcardKm };
    })
    .filter((p) => p.sent || p.received)
    .sort((a, b) => b.sent - a.sent || b.countries - a.countries || b.km - a.km);
  const top = <K extends "sent" | "received" | "countries" | "km">(key: K) => {
    const best = [...people].sort((a, b) => b[key] - a[key])[0];
    return best && best[key] > 0 ? best : null;
  };

  // Pen pals: the two who sent each other the most, both ways together
  const pairs = new Map<string, { a: string; b: string; count: number }>();
  for (const c of cards) {
    if (!c.sender_id) continue;
    const [a, b] = [c.sender_id, c.recipient_id].sort();
    const p = pairs.get(`${a}|${b}`) ?? { a, b, count: 0 };
    p.count++;
    pairs.set(`${a}|${b}`, p);
  }
  // A pair only counts if both of them wrote
  const penPals =
    [...pairs.values()]
      .filter((p) => cards.some((c) => c.sender_id === p.a && c.recipient_id === p.b) && cards.some((c) => c.sender_id === p.b && c.recipient_id === p.a))
      .sort((x, y) => y.count - x.count)[0] ?? null;

  const meetups = allMeetups
    .filter((m) => m.starts_on.startsWith(`${year}-`))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .map((m) => ({ ...m, places: meetupPlaces(m) }));
  const daysTogether = meetups.reduce((sum, m) => sum + daysBetween(m.starts_on, m.ends_on ?? m.starts_on) + 1, 0);
  const placesTogether = new Map<string, MeetupStop>();
  for (const m of meetups) for (const p of m.places) placesTogether.set(`${p.name}|${p.countryCode}`, p);

  return {
    year,
    cards,
    totalKm: timing.totalKm,
    countries,
    newCountries,
    byMonth,
    busiest,
    farthest,
    fastest: timing.fastest,
    slowest: timing.slowest,
    avgDays: timing.avgDays,
    people,
    mostSent: top("sent"),
    mostReceived: top("received"),
    mostCountries: top("countries"),
    penPals: penPals ? { a: byId.get(penPals.a), b: byId.get(penPals.b), count: penPals.count } : null,
    meetups,
    daysTogether,
    placesTogether: [...placesTogether.values()],
  };
}
