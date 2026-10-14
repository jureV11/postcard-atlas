import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { TabBar } from "@/components/TabBar";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, member } = await requireMember();
  const [{ data: group }, [me]] = await Promise.all([
    supabase.from("groups").select("name").eq("id", member.group_id).single(),
    signAvatarUrls(supabase, [member]),
  ]);

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-40 border-b border-ink/10 bg-paper/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16">
          <Link href="/" className="min-w-0 shrink">
            <Brand subtitle={group?.name} />
          </Link>
          <span className="hidden sm:block">
            <NavLinks />
          </span>
          <Link href={`/members/${member.id}`} aria-label="Your profile" className="shrink-0 rounded-full p-1">
            <Avatar name={me.display_name} color={me.color} url={me.avatar_url} size={34} />
          </Link>
        </div>
      </header>
      {/* Bottom padding clears the phone tab bar */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:pb-16 sm:pt-6">{children}</main>
      <TabBar />
    </div>
  );
}
