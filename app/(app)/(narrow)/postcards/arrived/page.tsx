import Link from "next/link";
import { requireMember } from "@/lib/session";
import { loadGroupData } from "@/lib/postcards";
import { ArrivedFlow } from "./ArrivedFlow";

// Deliberately no "N postcards on the way to you" — knowing one is coming is a spoiler.
export default async function ArrivedPage() {
  const { supabase, member } = await requireMember();
  const { members } = await loadGroupData(supabase, member);
  const others = members.filter((m) => m.id !== member.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/postcards" className="text-sm text-ink-soft hover:text-ink">
          ← Postcards
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">A postcard arrived!</h1>
        <p className="mt-1 text-ink-soft">
          Tell us who signed it and which country the stamp is from, and we&apos;ll match it to the card they logged.
        </p>
      </div>
      <ArrivedFlow groupId={member.group_id} senders={others} />
    </div>
  );
}
