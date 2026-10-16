"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { City } from "@/lib/geo";

type Result = { error?: string };

export async function logPostcard(input: {
  recipientId: string;
  from: City;
  sentOn: string;
  message: string;
  note: string;
}): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_postcard", {
    p_id: null,
    p_recipient_id: input.recipientId,
    p_from_city: input.from.name,
    p_from_country: input.from.country,
    p_from_country_code: input.from.countryCode,
    p_from_lat: input.from.lat,
    p_from_lng: input.from.lng,
    p_sent_on: input.sentOn,
    p_message: input.message,
    p_note: input.note,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id: data as string };
}

export async function updatePostcard(input: {
  id: string;
  recipientId: string;
  from: City;
  sentOn: string;
  message: string;
  note: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_postcard", {
    p_id: input.id,
    p_recipient_id: input.recipientId,
    p_from_city: input.from.name,
    p_from_country: input.from.country,
    p_from_country_code: input.from.countryCode,
    p_from_lat: input.from.lat,
    p_from_lng: input.from.lng,
    p_sent_on: input.sentOn,
    p_message: input.message,
    p_note: input.note,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function updateReceived(id: string, receivedOn: string, message: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_received", {
    p_id: id,
    p_received_on: receivedOn,
    p_message: message,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Recipient matched the wrong card: put it back in transit and remove its photos. */
export async function unmarkReceived(id: string, groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmark_received", { p_id: id });
  if (error) return { error: error.message };

  const folder = `${groupId}/${id}`;
  const { data: files } = await supabase.storage.from("postcards").list(folder);
  if (files?.length) {
    await supabase.storage.from("postcards").remove(files.map((f) => `${folder}/${f.name}`));
  }
  revalidatePath("/", "layout");
  return {};
}

/** Find which mystery card just arrived, from the sender (and stamp country if needed). */
export async function findIncoming(
  senderId: string,
  countryCode: string | null,
): Promise<{ match?: { id: string; sentOn: string; hasMessage: boolean }; needCountry?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("find_incoming_postcard", { p_sender_id: senderId, p_country_code: countryCode })
    .maybeSingle();
  if (error) {
    if (error.message.includes("NEED_COUNTRY")) return { needCountry: true, error: "Which country is the stamp from?" };
    if (error.message.includes("NO_MATCH")) {
      // Deliberately doesn't say which answer was wrong, so it can't be guessed one at a time.
      return {
        error:
          "No match. Double-check who signed it and the country on the stamp — or, if they haven't logged it yet, give them a nudge!",
      };
    }
    return { error: error.message };
  }
  const row = data as { id: string; sent_on: string; has_message: boolean } | null;
  if (!row) return { error: "Couldn't find that postcard" };
  return { match: { id: row.id, sentOn: row.sent_on, hasMessage: row.has_message } };
}

export async function setPostcardPhotos(id: string, frontPath: string | null, backPath: string | null): Promise<Result> {
  if (!frontPath && !backPath) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_postcard_photos", {
    p_id: id,
    p_front_path: frontPath,
    p_back_path: backPath,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Sender only: it never arrived. Goes public like an arrived card (same trip rule). */
export async function markLost(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_lost", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Sender only: it's still on its way after all. */
export async function unmarkLost(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmark_lost", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function markReceived(id: string, receivedOn: string, message: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_received", {
    p_id: id,
    p_received_on: receivedOn,
    p_message: message,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deletePostcard(id: string, groupId: string): Promise<Result> {
  const supabase = await createClient();

  // Remove the photos first — once the row is gone the storage policy can't check ownership.
  const folder = `${groupId}/${id}`;
  const { data: files } = await supabase.storage.from("postcards").list(folder);
  if (files?.length) {
    await supabase.storage.from("postcards").remove(files.map((f) => `${folder}/${f.name}`));
  }

  const { error } = await supabase.rpc("delete_postcard", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
