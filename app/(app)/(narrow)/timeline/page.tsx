import Link from "next/link";
import { Timeline, type TimelineEntry } from "@/components/Timeline";
import { loadMeetups, meetupDates } from "@/lib/meetups";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";

export default async function TimelinePage() {
  const { supabase, member } = await requireMember();
  const [meetups, { membersById }] = await Promise.all([loadMeetups(supabase), loadGroupData(supabase, member)]);

  const entries: TimelineEntry[] = meetups.map((m) => ({
    id: m.id,
    title: m.title,
    dates: meetupDates(m),
    startsOn: m.starts_on,
    city: m.city,
    country: m.country,
    countryCode: m.country_code,
    photoUrl: m.photos[0]?.url ?? null,
    members: m.memberIds.flatMap((id) => membersById.get(id) ?? []),
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Timeline</h1>
          <p className="mt-1 text-ink-soft">Every time we met up, from the first one to the next one.</p>
        </div>
        <Link href="/timeline/new" className="btn">
          + Add a meetup
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center">
          <p className="font-display text-xl font-semibold">Nothing on the line yet</p>
          <p className="mt-1 text-ink-soft">Add the first time you all met up: a trip, a weekend, a night out.</p>
          <Link href="/timeline/new" className="btn mt-4">
            Add the first meetup
          </Link>
        </div>
      ) : (
        <Timeline entries={entries} today={today} />
      )}
    </div>
  );
}
