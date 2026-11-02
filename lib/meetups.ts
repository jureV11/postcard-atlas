import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/dates";
import { signPaths } from "@/lib/storage";
import type { Meetup, MeetupNote, MeetupPhoto, Member, Postcard } from "@/lib/types";

export const MAX_MEETUP_PHOTOS = 50;

export type MeetupWithPhotos = Meetup & {
  memberIds: string[];
  notes: MeetupNote[]; // oldest first
  photos: (MeetupPhoto & { url: string | null })[]; // in the order people put them
};

/** The group's meetups (all of them, or one), oldest first, with who was there and signed photo URLs. */
export async function loadMeetups(supabase: SupabaseClient, id?: string): Promise<MeetupWithPhotos[]> {
  let query = supabase.from("meetups").select("*, meetup_members(member_id), meetup_photos(*), meetup_notes(*)").order("starts_on");
  if (id) query = query.eq("id", id);
  const { data } = await query;
  type Row = Meetup & { meetup_members: { member_id: string }[]; meetup_photos: MeetupPhoto[]; meetup_notes: MeetupNote[] };
  const rows = (data ?? []) as Row[];

  const urls = await signPaths(supabase, "meetups", rows.flatMap((r) => r.meetup_photos.map((p) => p.path)));
  return rows.map(({ meetup_members, meetup_photos, meetup_notes, ...m }) => ({
    ...m,
    memberIds: meetup_members.map((mm) => mm.member_id),
    notes: [...meetup_notes].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    photos: [...meetup_photos]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at))
      .map((p) => ({ ...p, url: urls.get(p.path) ?? null })),
  }));
}

/** The meetup's main photo (or the first one). */
export function mainPhoto<P extends Pick<MeetupPhoto, "is_main">>(photos: P[]): P | undefined {
  return photos.find((p) => p.is_main) ?? photos[0];
}

/** CSS object-position for a cropped photo: the part someone chose, or the middle. */
export function photoFocus(p: Pick<MeetupPhoto, "focus_x" | "focus_y">): string {
  return `${p.focus_x ?? 50}% ${p.focus_y ?? 50}%`;
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
