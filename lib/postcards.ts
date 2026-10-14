import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, Postcard } from "@/lib/types";
import { signAvatarUrls } from "@/lib/storage";

/**
 * Who may see a card (mirrors the `postcard_feed` view, as a second guard so
 * nothing leaks to the browser even if a migration is missing):
 *   - its sender, always;
 *   - its recipient, once they've received it;
 *   - everyone, once it's public (it and the rest of its trip have all arrived).
 * Nobody else learns that a card in transit even exists.
 */
export function visibleTo(card: Postcard, viewerId: string): boolean {
  if (card.sender_id === viewerId) return true;
  if (card.status !== "received") return false;
  if (card.recipient_id === viewerId) return true;
  return card.is_public === true;
}

/** Everything most pages need: the group's postcards plus members (with avatars) by id. */
export async function loadGroupData(supabase: SupabaseClient, viewer: Member) {
  const [{ data: cardRows }, { data: memberRows }] = await Promise.all([
    supabase.from("postcard_feed").select("*").order("sent_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("members").select("*").eq("group_id", viewer.group_id).order("created_at"),
  ]);
  const members = await signAvatarUrls(supabase, (memberRows ?? []) as Member[]);
  return {
    postcards: ((cardRows ?? []) as Postcard[]).filter((c) => visibleTo(c, viewer.id)),
    members,
    membersById: new Map(members.map((m) => [m.id, m])),
  };
}
