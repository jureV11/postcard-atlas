import type { SupabaseClient } from "@supabase/supabase-js";

// Reactions and comments on postcards (migration 0024). The database decides
// who sees them: the same people who can see the card.

export const REACTIONS = ["❤️", "😍", "😂", "🤯", "🔥", "👏"] as const; // the database checks this list too
export type Reaction = (typeof REACTIONS)[number];
export const MAX_COMMENT = 2000; // characters (the database checks it too)

export type ReactionRow = { emoji: Reaction; member_id: string };
export type CommentRow = { id: string; member_id: string; body: string; created_at: string; edited_at: string | null };

/** A card's reactions and comments (oldest first). Empty if migration 0024 hasn't run yet. */
export async function loadPostcardChat(supabase: SupabaseClient, cardId: string) {
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from("postcard_reactions").select("emoji, member_id").eq("postcard_id", cardId).order("created_at"),
    supabase.from("postcard_comments").select("id, member_id, body, created_at, edited_at").eq("postcard_id", cardId).order("created_at"),
  ]);
  return { reactions: (reactions ?? []) as ReactionRow[], comments: (comments ?? []) as CommentRow[] };
}
