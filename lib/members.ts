import type { Member } from "@/lib/types";

export const isFormer = (m: Pick<Member, "left_at">) => m.left_at !== null && m.left_at !== undefined;

/**
 * People who left stay in the group's history, labelled "(former member)".
 * Applied wherever members are loaded for display, so every name — postcards,
 * map, leaderboard, profiles — shows it without each page having to remember.
 */
export function withFormerLabel<T extends Member>(m: T): T {
  return isFormer(m) ? { ...m, display_name: `${m.display_name} (former member)` } : m;
}
