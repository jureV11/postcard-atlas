import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import { LeaveGroupButton } from "./LeaveGroupButton";
import { PasswordForm } from "./PasswordForm";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { supabase, user, member } = await requireMember();

  const [{ data: others }, [me], { data: group }] = await Promise.all([
    supabase.from("members").select("color").eq("group_id", member.group_id).neq("id", member.id),
    signAvatarUrls(supabase, [member]),
    supabase.from("groups").select("name").eq("id", member.group_id).single(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Your profile</h1>

      <section className="card">
        <SettingsForm
          member={member}
          avatarUrl={me.avatar_url}
          takenColors={(others ?? []).map((o) => o.color as string)}
        />
      </section>

      <section className="card">
        <PasswordForm />
      </section>

      <section className="card flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-soft">Signed in as</p>
          <p className="truncate font-medium">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost">Sign out</button>
        </form>
      </section>

      <section className="card">
        <LeaveGroupButton groupName={group?.name ?? "this group"} />
      </section>
    </div>
  );
}
