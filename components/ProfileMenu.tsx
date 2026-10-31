"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

/** The avatar in the header: opens a small menu with the profile, settings and sign out. */
export function ProfileMenu({
  memberId,
  name,
  color,
  avatarUrl,
  email,
}: {
  memberId: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex min-h-11 w-full items-center rounded-[6px] px-3 text-left text-sm font-medium transition hover:bg-paper-deep/60";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your profile"
        aria-expanded={open}
        aria-controls="profile-menu"
        className={`block rounded-full p-0.5 ring-2 transition ${open ? "ring-paper/60" : "ring-paper/25 hover:ring-paper/60"}`}
      >
        <Avatar name={name} color={color} url={avatarUrl} size={34} />
      </button>
      {open && (
        <div
          id="profile-menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-[8px] border border-ink/10 bg-[#fffdf8] p-1.5 text-ink shadow-[0_12px_32px_-12px_rgb(42_38_34/0.45)]"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="text-xs text-ink-soft">Signed in as</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
          <div className="border-t border-ink/10 py-1">
            <Link href={`/members/${memberId}`} className={item}>
              Your profile
            </Link>
            <Link href="/settings" className={item}>
              Edit profile
            </Link>
          </div>
          <form action="/auth/signout" method="post" className="border-t border-ink/10 pt-1">
            <button className={`${item} text-stamp`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
