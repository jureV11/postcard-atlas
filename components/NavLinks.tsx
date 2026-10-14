"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Map", short: "Map" },
  { href: "/postcards", label: "Postcards", short: "Cards" },
  { href: "/leaderboard", label: "Leaderboard", short: "Ranks" },
  { href: "/group", label: "Group", short: "Group" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 sm:gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <span className="sm:hidden">{l.short}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
