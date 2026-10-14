"use client";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import type { MemberWithAvatar } from "@/lib/types";

/** Pick one member — or several with `multiple` (then `value`/`onChange` use arrays). */
export function MemberPicker(
  props:
    | { members: MemberWithAvatar[]; multiple?: false; value: string | null; onChange: (id: string) => void }
    | { members: MemberWithAvatar[]; multiple: true; value: string[]; onChange: (ids: string[]) => void },
) {
  const { members } = props;
  const isSelected = (id: string) => (props.multiple ? props.value.includes(id) : props.value === id);
  const toggle = (id: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(id) ? props.value.filter((v) => v !== id) : [...props.value, id]);
    } else {
      props.onChange(id);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role={props.multiple ? "group" : "radiogroup"}>
      {members.map((m) => {
        const selected = isSelected(m.id);
        return (
          <button
            key={m.id}
            type="button"
            role={props.multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            onClick={() => toggle(m.id)}
            className={`flex items-center gap-2.5 rounded-xl border bg-white p-2.5 text-left transition ${
              selected ? "border-transparent" : "border-ink/10 hover:border-ink/25"
            }`}
            style={selected ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined}
          >
            <Avatar name={m.display_name} color={m.color} url={m.avatar_url} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{m.display_name}</span>
              <span className="flex items-center gap-1 truncate text-xs text-ink-soft">
                <Flag code={m.home_country_code} size={12} />
                {m.home_city}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
