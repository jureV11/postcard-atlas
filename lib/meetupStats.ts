import { meetupPlaces } from "@/lib/meetups";
import type { YearBar } from "@/lib/passport";
import type { Meetup, Member } from "@/lib/types";

type MeetupLike = Pick<Meetup, "starts_on" | "ends_on" | "city" | "country" | "country_code" | "lat" | "lng" | "stops"> & {
  memberIds: string[];
};

export type MeetupStats = {
  past: number;
  upcoming: number;
  places: number;
  countries: number;
  days: number; // days spent together, counting every day of each meetup
  years: YearBar[]; // meetups per year, from the first one to this year
  busiest: YearBar | null;
  attendance: { member: Member; count: number }[]; // most first
  pairs: { a: Member; b: Member; count: number }[]; // every pair that has met up, the most-together first
};

/** Counts over the meetups that have already happened (the ones still to come only as a number). */
export function meetupStats(meetups: MeetupLike[], members: Member[], today: string): MeetupStats {
  const past = meetups.filter((m) => m.starts_on <= today);
  const current = members.filter((m) => !m.left_at);
  const byId = new Map(current.map((m) => [m.id, m]));

  const dayCount = (m: MeetupLike) => {
    const end = m.ends_on && m.ends_on > m.starts_on ? m.ends_on : m.starts_on;
    return Math.round((Date.parse(end) - Date.parse(m.starts_on)) / 86_400_000) + 1;
  };

  const count = new Map(current.map((m) => [m.id, 0]));
  const together = new Map<string, number>();
  for (const m of past) {
    const there = [...new Set(m.memberIds)].filter((id) => byId.has(id)).sort();
    for (const id of there) count.set(id, (count.get(id) ?? 0) + 1);
    for (let i = 0; i < there.length; i++)
      for (let j = i + 1; j < there.length; j++) {
        const key = `${there[i]}|${there[j]}`;
        together.set(key, (together.get(key) ?? 0) + 1);
      }
  }

  const years: YearBar[] = [];
  if (past.length) {
    const first = Math.min(...past.map((m) => Number(m.starts_on.slice(0, 4))));
    for (let y = first; y <= Number(today.slice(0, 4)); y++)
      years.push({ year: y, count: past.filter((m) => Number(m.starts_on.slice(0, 4)) === y).length });
  }

  return {
    past: past.length,
    years,
    busiest: years.length ? years.reduce((b, y) => (y.count > b.count ? y : b)) : null,
    upcoming: meetups.length - past.length,
    // Every stop of a trip counts
    places: new Set(past.flatMap((m) => meetupPlaces(m).map((p) => `${p.name}|${p.countryCode}`))).size,
    countries: new Set(past.flatMap((m) => meetupPlaces(m).map((p) => p.countryCode))).size,
    days: past.reduce((sum, m) => sum + dayCount(m), 0),
    attendance: current
      .map((member) => ({ member, count: count.get(member.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.member.display_name.localeCompare(b.member.display_name)),
    pairs: [...together.entries()]
      .map(([key, n]) => {
        const [a, b] = key.split("|");
        return { a: byId.get(a)!, b: byId.get(b)!, count: n };
      })
      .sort((x, y) => y.count - x.count || `${x.a.display_name}${x.b.display_name}`.localeCompare(`${y.a.display_name}${y.b.display_name}`)),
  };
}
