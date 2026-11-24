import type { PostgrestClient } from "@supabase/postgrest-js";
import { formatDate } from "@/lib/dates";
import { signPaths } from "@/lib/storage";
import type { Meetup, MeetupNote, MeetupPhoto, MeetupStop, Member, Postcard } from "@/lib/types";

export const MAX_MEETUP_PHOTOS = 50;
export const MAX_WRITE_UP = 200_000; // characters, about 33,000 words (the database checks it too)
export const MAX_STOPS = 30; // places on one trip after the first (the database checks it too)

export type MeetupWithPhotos = Meetup & {
  memberIds: string[];
  notes: MeetupNote[]; // oldest first
  photos: (MeetupPhoto & { url: string | null; posterUrl: string | null })[]; // in the order people put them (videos too, #55)
};

/** The group's meetups (all of them, or one), oldest first, with who was there and signed photo URLs. */
export async function loadMeetups(supabase: PostgrestClient, id?: string): Promise<MeetupWithPhotos[]> {
  let query = supabase.from("meetups").select("*, meetup_members(member_id), meetup_photos(*), meetup_notes(*)").order("starts_on");
  if (id) query = query.eq("id", id);
  const { data } = await query;
  type Row = Meetup & { meetup_members: { member_id: string }[]; meetup_photos: MeetupPhoto[]; meetup_notes: MeetupNote[] };
  const rows = (data ?? []) as Row[];

  const urls = await signPaths(supabase, "meetups", rows.flatMap((r) => r.meetup_photos.flatMap((p) => [p.path, p.poster_path])));
  return rows.map(({ meetup_members, meetup_photos, meetup_notes, ...m }) => ({
    ...m,
    memberIds: meetup_members.map((mm) => mm.member_id),
    notes: [...meetup_notes].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    photos: [...meetup_photos]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at))
      .map((p) => ({ ...p, url: urls.get(p.path) ?? null, posterUrl: p.poster_path ? (urls.get(p.poster_path) ?? null) : null })),
  }));
}

/** The meetup's main photo (or the first photo). Never a video: it's shown as a picture. */
export function mainPhoto<P extends Pick<MeetupPhoto, "is_main" | "kind">>(photos: P[]): P | undefined {
  return photos.find((p) => p.is_main && p.kind !== "video") ?? photos.find((p) => p.kind !== "video");
}

/** CSS object-position for a cropped photo: the part someone chose, or the middle. */
export function photoFocus(p: Pick<MeetupPhoto, "focus_x" | "focus_y">): string {
  return `${p.focus_x ?? 50}% ${p.focus_y ?? 50}%`;
}

/** Every place on a meetup in the order you went: its own city first, then the stops. */
export function meetupPlaces(m: Pick<Meetup, "city" | "country" | "country_code" | "lat" | "lng" | "stops">): MeetupStop[] {
  const first =
    m.city && m.country_code && m.lat !== null && m.lng !== null
      ? [{ name: m.city, country: m.country ?? "", countryCode: m.country_code, lat: m.lat, lng: m.lng }]
      : [];
  return [...first, ...(m.stops ?? [])];
}

type FlagsLike = Pick<Meetup, "city" | "country" | "country_code" | "lat" | "lng" | "stops" | "flag_codes">;

/**
 * The flags a meetup shows (#65), in the order you went: the countries picked by hand,
 * or the first place's when none were (or none of the picked ones are on it any more).
 * These are also the countries it counts in the stats, so a two-hour stop on the way
 * doesn't count as a country visited.
 */
export function meetupFlags(m: FlagsLike): string[] {
  return pickedFlags(
    meetupPlaces(m).map((p) => p.countryCode),
    m.flag_codes ?? [],
  );
}

/** The same rule from a list of country codes in order (the edit form uses it too). */
export function pickedFlags(countryCodes: string[], picked: string[]): string[] {
  const countries = [...new Set(countryCodes)];
  const chosen = countries.filter((c) => picked.includes(c));
  return chosen.length ? chosen : countries.slice(0, 1);
}

/** Past meetups you were at and haven't written about yet (#67), oldest first. Only you see these. */
export async function writeUpsToDo(
  supabase: PostgrestClient,
  memberId: string,
  today: string,
): Promise<{ id: string; title: string; dates: string }[]> {
  const [{ data: tagged }, { data: written }] = await Promise.all([
    supabase.from("meetup_members").select("meetup_id").eq("member_id", memberId),
    supabase.from("meetup_notes").select("meetup_id").eq("member_id", memberId),
  ]);
  const done = new Set((written ?? []).map((n) => n.meetup_id as string));
  const ids = (tagged ?? []).map((t) => t.meetup_id as string).filter((id) => !done.has(id));
  if (!ids.length) return [];
  const { data } = await supabase.from("meetups").select("id, title, starts_on, ends_on").in("id", ids).lte("starts_on", today).order("starts_on");
  return ((data ?? []) as Pick<Meetup, "id" | "title" | "starts_on" | "ends_on">[]).map((m) => ({ id: m.id, title: m.title, dates: meetupDates(m) }));
}

/** "12 Mar 2025" or "12–15 Mar 2025" or "30 Dec 2024 – 2 Jan 2025". */
export function meetupDates(m: Pick<Meetup, "starts_on" | "ends_on">): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, mo, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, day)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
  };
  const full = { day: "numeric", month: "short", year: "numeric" } as const;
  if (!m.ends_on || m.ends_on === m.starts_on) return fmt(m.starts_on, full);
  const [y1, m1] = m.starts_on.split("-");
  const [y2, m2] = m.ends_on.split("-");
  if (y1 === y2 && m1 === m2) return `${fmt(m.starts_on, { day: "numeric" })}–${fmt(m.ends_on, full)}`;
  if (y1 === y2) return `${fmt(m.starts_on, { day: "numeric", month: "short" })} – ${fmt(m.ends_on, full)}`;
  return `${fmt(m.starts_on, full)} – ${fmt(m.ends_on, full)}`;
}

/** Cards a meetup can link to: delivered and public, so nothing gives a surprise away. Newest first. */
export function postcardOptions(cards: Postcard[], membersById: Map<string, Member>): { id: string; label: string }[] {
  return cards
    .filter((c) => c.status === "received" && c.is_public && c.sender_id)
    .map((c) => ({
      id: c.id,
      label: `${membersById.get(c.sender_id!)?.display_name ?? "?"} → ${membersById.get(c.recipient_id)?.display_name ?? "?"} · ${c.from_city ?? ""} · ${formatDate(c.sent_on)}`,
    }));
}
