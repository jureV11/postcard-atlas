"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { MAX_COMMENT, REACTIONS, type Reaction } from "@/lib/postcardChat";
import { notifyMembers } from "@/lib/push";
import { requireMember } from "@/lib/session";

type Result = { error?: string };

const NOT_YET = "You can react and comment once the card is out of the post.";

/** Add your reaction (on), or take it back. */
export async function toggleReaction(cardId: string, emoji: Reaction, on: boolean): Promise<Result> {
  const { supabase, member } = await requireMember();
  if (!REACTIONS.includes(emoji)) return { error: "That reaction isn't one of the options." };
  const { error } = on
    ? await supabase
        .from("postcard_reactions")
        .upsert({ postcard_id: cardId, member_id: member.id, emoji }, { onConflict: "postcard_id,member_id,emoji", ignoreDuplicates: true })
    : await supabase.from("postcard_reactions").delete().eq("postcard_id", cardId).eq("member_id", member.id).eq("emoji", emoji);
  if (error) return { error: error.code === "42501" ? NOT_YET : error.message };
  revalidatePath(`/postcards/${cardId}`);
  return {};
}

export async function addComment(cardId: string, body: string): Promise<Result> {
  const { supabase, member } = await requireMember();
  const text = body.trim();
  if (!text) return { error: "Write something first." };
  if (text.length > MAX_COMMENT) return { error: `Keep it under ${MAX_COMMENT.toLocaleString("en")} characters.` };
  const { error } = await supabase.from("postcard_comments").insert({ postcard_id: cardId, member_id: member.id, body: text });
  if (error) return { error: error.code === "42501" ? NOT_YET : error.message };

  // The inbox message comes from the database; a phone notification goes to the
  // same people: the sender, the recipient and earlier commenters who can see it
  after(async () => {
    const { data: card } = await supabase
      .from("postcard_feed")
      .select("id, sender_id, recipient_id, status, is_public")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) return;
    const { data: rows } = await supabase.from("postcard_comments").select("member_id").eq("postcard_id", cardId);
    const arrived = card.status === "received";
    // Before it's public, only its sender (and its recipient, once it's arrived) can see it
    const canSee = (id: string) => card.is_public || id === card.sender_id || (arrived && id === card.recipient_id);
    const { data: active } = await supabase.from("members").select("id").eq("group_id", member.group_id).is("left_at", null);
    const stillHere = new Set((active ?? []).map((m) => m.id as string));
    const people = new Set<string>([card.sender_id, card.recipient_id, ...(rows ?? []).map((r) => r.member_id as string)]);
    const to = [...people].filter((id) => id && id !== member.id && stillHere.has(id) && canSee(id));
    await notifyMembers(supabase, to, {
      title: `💬 ${member.display_name} commented`,
      body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      url: `/postcards/${cardId}#comments`,
      tag: `comment-${cardId}`,
    });
  });

  revalidatePath(`/postcards/${cardId}`);
  return {};
}

/** Change your own comment; emptying it deletes it. */
export async function editComment(cardId: string, commentId: string, body: string): Promise<Result> {
  const { supabase, member } = await requireMember();
  const text = body.trim();
  if (!text) return deleteComment(cardId, commentId);
  if (text.length > MAX_COMMENT) return { error: `Keep it under ${MAX_COMMENT.toLocaleString("en")} characters.` };
  const { error } = await supabase
    .from("postcard_comments")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("member_id", member.id);
  if (error) return { error: error.message };
  revalidatePath(`/postcards/${cardId}`);
  return {};
}

export async function deleteComment(cardId: string, commentId: string): Promise<Result> {
  const { supabase, member } = await requireMember();
  const { error } = await supabase.from("postcard_comments").delete().eq("id", commentId).eq("member_id", member.id);
  if (error) return { error: error.message };
  revalidatePath(`/postcards/${cardId}`);
  return {};
}
