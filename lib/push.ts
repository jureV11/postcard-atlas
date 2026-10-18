import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Phone notifications (web push), sent from the server only. Configured by
// server settings — VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and
// PUSH_SECRET (see HOSTING.md). Without them everything here quietly does nothing.

type Payload = { title: string; body: string; url?: string; tag?: string };

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.PUSH_SECRET);
}

/** Sends to every phone of these members. Never throws — a failed notification mustn't break anything. */
export async function notifyMembers(supabase: SupabaseClient, memberIds: string[], payload: Payload): Promise<void> {
  if (!configured() || memberIds.length === 0) return;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:postcard-atlas@example.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    const { data, error } = await supabase.rpc("push_targets", {
      p_secret: process.env.PUSH_SECRET,
      p_member_ids: memberIds,
    });
    if (error || !data) return;
    await Promise.all(
      (data as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 },
          );
        } catch (err) {
          // 404/410: that phone unsubscribed or reinstalled — forget it.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await supabase.rpc("forget_push_endpoint", { p_secret: process.env.PUSH_SECRET, p_endpoint: s.endpoint });
        }
      }),
    );
  } catch {
    // Notifications are a nice-to-have; never let them fail the action.
  }
}

/**
 * After a card is marked received: tell its sender it arrived, and if that made
 * it public (it and its trip are all in), tell everyone else something new is up.
 * Nothing is ever sent about a card that's still on its way.
 */
export async function notifyCardArrived(supabase: SupabaseClient, cardId: string): Promise<void> {
  if (!configured()) return;
  const { data: card } = await supabase
    .from("postcard_feed")
    .select("id, group_id, sender_id, recipient_id, from_city, is_public, status")
    .eq("id", cardId)
    .maybeSingle();
  if (!card || card.status !== "received" || !card.sender_id) return;

  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, user_id, left_at")
    .eq("group_id", card.group_id);
  const all = (members ?? []) as { id: string; display_name: string; user_id: string | null; left_at: string | null }[];
  const name = (id: string) => all.find((m) => m.id === id)?.display_name ?? "Someone";
  const url = `/postcards/${card.id}`;

  await notifyMembers(supabase, [card.sender_id], {
    title: "📬 Your postcard arrived!",
    body: `${name(card.recipient_id)} got your card from ${card.from_city}.`,
    url,
    tag: `arrived-${card.id}`,
  });

  if (card.is_public) {
    const others = all
      .filter((m) => m.user_id && !m.left_at && m.id !== card.sender_id && m.id !== card.recipient_id)
      .map((m) => m.id);
    await notifyMembers(supabase, others, {
      title: "🗺️ New postcard on the map",
      body: `${name(card.sender_id)} → ${name(card.recipient_id)}: a card from ${card.from_city} just landed.`,
      url,
      tag: `revealed-${card.id}`,
    });
  }
}
