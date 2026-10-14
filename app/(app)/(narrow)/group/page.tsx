import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { InviteCard } from "@/components/InviteCard";
import { isFormer } from "@/lib/members";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import type { Group, Member, MemberWithAvatar } from "@/lib/types";
import { LeaveGroupButton } from "./LeaveGroupButton";

export default async function GroupHome() {
  const { supabase, member } = await requireMember();

  const [{ data: group }, { data: memberRows }] = await Promise.all([
    supabase.from("groups").select("*").eq("id", member.group_id).single(),
    supabase.from("members").select("*").eq("group_id", member.group_id).order("created_at"),
  ]);
  const g = group as Group;
  const everyone = await signAvatarUrls(supabase, (memberRows ?? []) as Member[]);
  const members = everyone.filter((m) => !isFormer(m)); // oldest first
  const former = everyone.filter(isFormer);

  const isOwner = g.owner_member_id === member.id;
  const heir = members.find((m) => m.id !== member.id) ?? null; // longest-standing other member

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{g.name}</h1>
        <p className="mt-1 text-ink-soft">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>

      <InviteCard code={g.invite_code} groupName={g.name} />

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Members</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <MemberCard key={m.id} m={m} isMe={m.id === member.id} isOwner={m.id === g.owner_member_id} />
          ))}
        </ul>
      </section>

      {former.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Former members</h2>
          <p className="mb-3 text-sm text-ink-soft">Their postcards stay part of the group&apos;s history.</p>
          <ul className="grid gap-3 opacity-75 sm:grid-cols-2">
            {former.map((m) => (
              <MemberCard key={m.id} m={m} isMe={false} isOwner={false} />
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <LeaveGroupButton
          groupName={g.name}
          isOwner={isOwner}
          heirName={heir?.display_name ?? null}
          isLastMember={members.length === 1}
        />
      </section>
    </div>
  );
}

function MemberCard({ m, isMe, isOwner }: { m: MemberWithAvatar; isMe: boolean; isOwner: boolean }) {
  return (
    <li>
      <Link
        href={`/members/${m.id}`}
        className="card flex items-center gap-4 border-l-4 transition hover:bg-white"
        style={{ borderLeftColor: m.color }}
      >
        <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={48} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 font-medium">
            <span className="truncate">{m.display_name}</span>
            {isMe && <span className="text-xs font-normal text-ink-soft">(you)</span>}
            {isOwner && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">Owner</span>
            )}
            {isFormer(m) && <span className="text-xs font-normal text-ink-soft">(former member)</span>}
          </p>
          <p className="flex items-center gap-1.5 truncate text-sm text-ink-soft">
            <Flag code={m.home_country_code} size={16} />
            {m.home_city}, {m.home_country}
          </p>
        </div>
      </Link>
    </li>
  );
}
