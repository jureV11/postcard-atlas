import Link from "next/link";
import { postcardOptions } from "@/lib/meetups";
import { isFormer } from "@/lib/members";
import { loadGroupData } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { MeetupForm } from "../MeetupForm";

export default async function NewMeetupPage() {
  const { supabase, member } = await requireMember();
  const { postcards, members, membersById } = await loadGroupData(supabase, member);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/timeline" className="text-sm text-ink-soft hover:text-ink">
          ← Timeline
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Add a meetup</h1>
        <p className="mt-1 text-ink-soft">Photos and write-ups come next, on the meetup&apos;s own page.</p>
      </div>
      <MeetupForm
        initial={{ title: "", startsOn: "", endsOn: "", places: [], memberIds: [member.id], postcardId: "" }}
        members={members.filter((m) => !isFormer(m))}
        postcards={postcardOptions(postcards, membersById)}
      />
    </div>
  );
}
