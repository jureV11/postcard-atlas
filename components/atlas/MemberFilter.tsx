"use client";

import { Avatar } from "@/components/Avatar";
import type { MemberWithAvatar } from "@/lib/types";

export function MemberFilter({
  members,
  value,
  onChange,
}: {
  members: MemberWithAvatar[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const chip = "flex shrink-0 items-center gap-2 rounded-full border py-1 text-sm font-medium transition";
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`${chip} px-3.5 ${value === null ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white/70 hover:bg-white"}`}
      >
        Everyone
      </button>
      {members.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(active ? null : m.id)}
            className={`${chip} pl-1 pr-3.5 ${active ? "text-white" : "border-ink/15 bg-white/70 hover:bg-white"}`}
            style={active ? { background: m.color, borderColor: m.color } : undefined}
          >
            <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={24} />
            {m.display_name}
          </button>
        );
      })}
    </div>
  );
}
