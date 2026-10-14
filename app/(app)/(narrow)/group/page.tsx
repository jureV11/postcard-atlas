import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { InviteCard } from "@/components/InviteCard";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import type { Group, Member } from "@/lib/types";

export default async function GroupHome() {
  const { supabase, member } = await requireMember();

  const [{ data: group }, { data: memberRows }] = await Promise.all([
    supabase.from("groups").select("*").eq("id", member.group_id).single(),
    supabase.from("members").select("*").eq("group_id", member.group_id).order("created_at"),
  ]);
  const g = group as Group;
  const members = await signAvatarUrls(supabase, (memberRows ?? []) as Member[]);

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
            <li key={m.id}>
              <Link
                href={`/members/${m.id}`}
                className="card flex items-center gap-4 border-l-4 transition hover:bg-white"
                style={{ borderLeftColor: m.color }}
              >
                <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.display_name}
                    {m.id === member.id && <span className="ml-2 text-xs font-normal text-ink-soft">(you)</span>}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-sm text-ink-soft">
                    <Flag code={m.home_country_code} size={16} />
                    {m.home_city}, {m.home_country}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
