import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CountryOutline } from "@/components/CountryOutline";
import { Flag } from "@/components/Flag";
import { formatDate } from "@/lib/dates";
import { loadMeetups, MAX_MEETUP_PHOTOS, MAX_WRITE_UP, meetupDates } from "@/lib/meetups";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { MeetupNotes } from "./MeetupNotes";
import { MeetupPhotos } from "./MeetupPhotos";

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, member } = await requireMember();
  const [[m], { postcards, membersById }] = await Promise.all([loadMeetups(supabase, id), loadGroupData(supabase, member)]);
  if (!m) notFound();

  const me = membersById.get(member.id)!;
  const wasThere = m.memberIds.includes(member.id);
  const attendees = m.memberIds.flatMap((mid) => membersById.get(mid) ?? []);
  // Only a delivered, public card is linked, so nothing about a surprise shows
  const card = postcards.find((c) => c.id === m.postcard_id && c.status === "received" && c.is_public);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/timeline" className="text-sm text-ink-soft hover:text-ink">
          ← Timeline
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-wide text-ink-soft uppercase">{meetupDates(m)}</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{m.title}</h1>
            {m.city && (
              <p className="mt-1 flex items-center gap-1.5 text-ink-soft">
                {m.country_code && <Flag code={m.country_code} size={16} />}
                {m.city}
                {m.country ? `, ${m.country}` : ""}
              </p>
            )}
          </div>
          <Link href={`/timeline/${m.id}/edit`} className="btn-ghost shrink-0 px-4">
            Edit
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <MeetupPhotos
          meetupId={m.id}
          groupId={member.group_id}
          max={MAX_MEETUP_PHOTOS}
          photos={m.photos.map((p) => ({
            id: p.id,
            url: p.url,
            isMain: p.is_main,
            canRemove: p.uploaded_by === member.id || wasThere,
            by: p.uploaded_by ? (membersById.get(p.uploaded_by)?.display_name ?? null) : null,
            caption: p.caption ?? null,
            focusX: p.focus_x ?? null,
            focusY: p.focus_y ?? null,
          }))}
        />

        <div className="space-y-6">
          {m.city && m.country_code && m.lat !== null && m.lng !== null && (
            <section className="card p-3">
              <CountryOutline countryCode={m.country_code} countryName={m.country ?? ""} city={m.city} lat={m.lat} lng={m.lng} />
            </section>
          )}

          <section>
            <h2 className="mb-2 font-display text-lg font-semibold">Who was there</h2>
            {attendees.length ? (
              <ul className="flex flex-wrap gap-2">
                {attendees.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/members/${a.id}`}
                      className="flex items-center gap-2 rounded-full border border-ink/12 bg-[#fffdf8] py-1 pr-3 pl-1 text-sm hover:bg-white"
                    >
                      <Avatar name={a.display_name} color={a.color} url={a.avatar_url} size={24} />
                      {a.display_name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Nobody marked yet: add people with Edit.</p>
            )}
          </section>

          {card && (
            <Link href={`/postcards/${card.id}`} className="card flex items-center gap-3 p-4 transition hover:bg-white">
              <span className="text-2xl" aria-hidden="true">
                ✉
              </span>
              <span className="min-w-0 text-sm">
                <span className="block text-ink-soft">The postcard about it</span>
                <span className="block truncate font-medium">
                  {membersById.get(card.sender_id!)?.display_name} → {membersById.get(card.recipient_id)?.display_name} ·{" "}
                  {formatDate(card.sent_on)}
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>

      <MeetupNotes
        meetupId={m.id}
        max={MAX_WRITE_UP}
        me={me}
        notes={m.notes.map((n) => ({
          id: n.id,
          body: n.body,
          date: formatDate(n.updated_at.slice(0, 10)),
          author: membersById.get(n.member_id) ?? null,
          mine: n.member_id === member.id,
        }))}
      />
    </div>
  );
}
