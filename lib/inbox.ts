import type { SupabaseClient } from "@supabase/supabase-js";
import { achievementsFor } from "@/lib/achievements";
import { loadGroupData } from "@/lib/postcards";
import { computeStats } from "@/lib/stats";
import type { Member } from "@/lib/types";

export type InboxMessage = {
  id: string;
  kind: "arrived" | "achievement" | "meetup" | "comment";
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

/**
 * Tell the database which achievements this member has right now; it adds an
 * inbox message for any that are new (migration 0020). Never throws: the inbox
 * mustn't break a page, e.g. before the migration has run.
 */
export async function recordAchievements(supabase: SupabaseClient, member: Member): Promise<void> {
  try {
    const { postcards, members, membersById } = await loadGroupData(supabase, member);
    const stats = computeStats(members, postcards).get(member.id);
    if (!stats) return;
    const earned = achievementsFor(member, stats, postcards, membersById).filter((a) => a.earned);
    await supabase.rpc("record_achievements", { p_ids: earned.map((a) => a.id), p_names: earned.map((a) => a.name) });
  } catch {
    // Inbox is a nice-to-have
  }
}

/** Unread inbox messages, not counting binned ones (0 if the inbox isn't there yet). */
export async function unreadCount(supabase: SupabaseClient, memberId: string): Promise<number> {
  const { count } = await supabase
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .is("read_at", null)
    .is("deleted_at", null);
  return count ?? 0;
}

const RECENT_DAYS = 7;

/**
 * Your achievements unlocked in the last week, by id → when. The ones you
 * already had when the inbox first checked (the "_checked" moment) don't count.
 */
export async function recentAchievements(supabase: SupabaseClient, memberId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("member_achievements").select("achievement_id, earned_at").eq("member_id", memberId);
  const rows = (data ?? []) as { achievement_id: string; earned_at: string }[];
  const checked = Date.parse(rows.find((r) => r.achievement_id === "_checked")?.earned_at ?? "");
  const since = Date.now() - RECENT_DAYS * 86_400_000;
  return new Map(
    rows
      .filter((r) => {
        const at = Date.parse(r.earned_at);
        return r.achievement_id !== "_checked" && at > checked && at > since;
      })
      .map((r) => [r.achievement_id, new Date(r.earned_at).toISOString()]), // one format, so they sort right
  );
}
