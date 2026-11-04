import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMeetups, meetupPlaces, postcardOptions } from "@/lib/meetups";
import { isFormer } from "@/lib/members";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { MeetupForm } from "../../MeetupForm";

export default async function EditMeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, member } = await requireMember();
  const [[m], { postcards, members, membersById }] = await Promise.all([loadMeetups(supabase, id), loadGroupData(supabase, member)]);
  if (!m) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href={`/timeline/${m.id}`} className="text-sm text-ink-soft hover:text-ink">
          ← {m.title}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Edit meetup</h1>
      </div>
      <MeetupForm
        initial={{
          id: m.id,
          title: m.title,
          startsOn: m.starts_on,
          endsOn: m.ends_on ?? "",
          places: meetupPlaces(m),
          memberIds: m.memberIds,
          postcardId: m.postcard_id ?? "",
        }}
        // Former members who were there stay listed, so saving doesn't drop them
        members={members.filter((p) => !isFormer(p) || m.memberIds.includes(p.id))}
        postcards={postcardOptions(postcards, membersById)}
        canDelete={m.created_by === member.id}
      />
    </div>
  );
}
