import Link from "next/link";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import type { Member } from "@/lib/types";
import { NewPostcardForm } from "./NewPostcardForm";

export default async function NewPostcardPage() {
  const { supabase, member } = await requireMember();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("group_id", member.group_id)
    .neq("id", member.id)
    .order("display_name");
  const others = await signAvatarUrls(supabase, (data ?? []) as Member[]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/postcards" className="text-sm text-ink-soft hover:text-ink">
          ← Postcards
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Log a postcard</h1>
        <p className="mt-1 text-ink-soft">
          It stays a surprise: the recipient only sees which country it&apos;s coming from until it arrives.
        </p>
      </div>

      {others.length === 0 ? (
        <div className="card text-center">
          <p>There&apos;s nobody to send to yet.</p>
          <Link href="/group" className="btn mt-4">
            Invite your friends
          </Link>
        </div>
      ) : (
        <NewPostcardForm recipients={others} />
      )}
    </div>
  );
}
