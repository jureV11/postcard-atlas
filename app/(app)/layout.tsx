import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ServiceWorker } from "@/components/InstallApp";
import { NavLinks } from "@/components/NavLinks";
import { ProfileMenu } from "@/components/ProfileMenu";
import { TabBar } from "@/components/TabBar";
import { recordAchievements, unreadCount } from "@/lib/inbox";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, member } = await requireMember();
  // New achievements land in the inbox before it's counted
  const [{ data: group }, [me], unread] = await Promise.all([
    supabase.from("groups").select("name").eq("id", member.group_id).single(),
    signAvatarUrls(supabase, [member]),
    recordAchievements(supabase, member).then(() => unreadCount(supabase, member.id)),
  ]);

  return (
    // Clipped sideways: anything too wide for a phone would otherwise let the page
    // zoom out past the screen, leaving the header covering only part of it (#44).
    <div className="min-h-dvh overflow-x-clip">
      <header
        className="sticky top-0 z-40 bg-ink text-paper shadow-[0_8px_24px_-12px_rgb(42_38_34/0.6)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Three columns, the outer two equal, so the links sit in the middle of the screen */}
        <div className="mx-auto flex h-14 max-w-[1720px] items-center justify-between gap-3 px-safe sm:grid sm:h-16 sm:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="min-w-0 shrink justify-self-start">
            <Brand subtitle={group?.name} />
          </Link>
          <span className="hidden sm:block">
            <NavLinks />
          </span>
          <span className="flex justify-end">
            <ProfileMenu
              memberId={member.id}
              name={me.display_name}
              color={me.color}
              avatarUrl={me.avatar_url}
              unread={unread}
            />
          </span>
        </div>
        <div className="airmail-strip" aria-hidden="true" />
      </header>
      {/* Bottom padding clears the phone tab bar */}
      <main className="mx-auto max-w-[1720px] px-safe pb-28 pt-5 sm:pb-16 sm:pt-6">{children}</main>
      <TabBar />
      <ServiceWorker />
    </div>
  );
}
