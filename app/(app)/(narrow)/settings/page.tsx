import Link from "next/link";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import { PasswordForm } from "./PasswordForm";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { supabase, user, member } = await requireMember();

  const [{ data: others }, [me]] = await Promise.all([
    // Includes former members: they keep their colour, so it stays taken.
    supabase.from("members").select("color").eq("group_id", member.group_id).neq("id", member.id),
    signAvatarUrls(supabase, [member]),
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

      <p className="text-center text-sm text-ink-soft">
        Looking to leave the group? That&apos;s on the{" "}
        <Link href="/group" className="font-medium text-stamp hover:underline">
          Group
        </Link>{" "}
        tab.
      </p>
    </div>
  );
}
