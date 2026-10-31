import Link from "next/link";
import { Brand } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { ProfileMenu } from "@/components/ProfileMenu";
import { TabBar } from "@/components/TabBar";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, member } = await requireMember();
  const [{ data: group }, [me]] = await Promise.all([
    supabase.from("groups").select("name").eq("id", member.group_id).single(),
    signAvatarUrls(supabase, [member]),
  ]);

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-40 bg-ink text-paper shadow-[0_8px_24px_-12px_rgb(42_38_34/0.6)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1720px] items-center justify-between gap-3 px-4 sm:h-16">
          <Link href="/" className="min-w-0 shrink">
            <Brand subtitle={group?.name} />
          </Link>
          <span className="hidden sm:block">
            <NavLinks />
          </span>
          <ProfileMenu
            memberId={member.id}
            name={me.display_name}
            color={me.color}
            avatarUrl={me.avatar_url}
            email={user.email ?? ""}
          />
        </div>
        <div className="airmail-strip" aria-hidden="true" />
      </header>
      {/* Bottom padding clears the phone tab bar */}
      <main className="mx-auto max-w-[1720px] px-4 pb-28 pt-5 sm:pb-16 sm:pt-6">{children}</main>
      <TabBar />
    </div>
  );
}
