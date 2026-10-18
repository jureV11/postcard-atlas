"use server";

import { notifyMembers } from "@/lib/push";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
type Subscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Turn notifications on for this phone/browser. */
export async function savePushSubscription(sub: Subscription): Promise<Result> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Your browser didn't give a valid subscription." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
  });
  return error ? { error: error.message } : {};
}

export async function deletePushSubscription(endpoint: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return error ? { error: error.message } : {};
}

export async function hasPushSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_push_subscription", { p_endpoint: endpoint });
  return data === true;
}

/** "Send me a test": only ever to your own phones. */
export async function sendTestPush(): Promise<Result> {
  const { supabase, member } = await getSession();
  if (!member) return { error: "You're not in a group yet." };
  await notifyMembers(supabase, [member.id], {
    title: "📮 Test from Postcard Atlas",
    body: "Notifications work! You'll hear when your cards arrive and when new ones are revealed.",
    url: "/settings",
    tag: "test",
  });
  return {};
}
