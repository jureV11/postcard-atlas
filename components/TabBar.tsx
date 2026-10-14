"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const TABS = [
  { href: "/", label: "Map", icon: icon("M9 4 3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13m6-10.5v13") },
  { href: "/postcards", label: "Cards", icon: icon("M3 6h18v12H3zM3 7l9 6 9-6") },
  { href: "/postcards/new", label: "Log", primary: true },
  { href: "/leaderboard", label: "Ranks", icon: icon("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4m10-4h3a3 3 0 0 1-3 4") },
  { href: "/group", label: "Group", icon: icon("M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 8a3 3 0 0 0-3-3m1-5a2.5 2.5 0 1 0 0-5M5 19a3 3 0 0 1 3-3M7 11a2.5 2.5 0 1 1 0-5") },
];

/** Bottom navigation for phones (the header nav takes over from `sm` up). */
export function TabBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/postcards" ? pathname === "/postcards" || /^\/postcards\/(?!new)/.test(pathname) : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid h-16 grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href} className="flex">
              {t.primary ? (
                <Link href={t.href} aria-label="Log a postcard" className="flex flex-1 items-center justify-center">
                  <span className="-mt-5 flex size-14 items-center justify-center rounded-full bg-stamp text-3xl leading-none text-white shadow-lg ring-4 ring-paper">
                    +
                  </span>
                </Link>
              ) : (
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
