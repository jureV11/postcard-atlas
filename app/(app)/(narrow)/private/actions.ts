"use server";

import { revalidatePath } from "next/cache";
import type { City } from "@/lib/geo";
import { requireMember } from "@/lib/session";

type Result = { error?: string };

export type PrivateCardInput = {
  id?: string;
  direction: "sent" | "received";
  person: string;
  from: City | null;
  sentOn: string;
  receivedOn: string | null;
  message: string;
  note: string;
};

/** Add or change one of your private postcards (only you can ever see them). Returns its id. */
export async function savePrivateCard(input: PrivateCardInput): Promise<Result & { id?: string }> {
  const { supabase } = await requireMember();
  if (!input.sentOn) return { error: "When was it sent?" };
  if (input.receivedOn && input.receivedOn < input.sentOn) return { error: "It can't arrive before it was sent." };

  const fields = {
    direction: input.direction,
    person: input.person.trim(),
    from_city: input.from?.name ?? null,
    from_country: input.from?.country ?? null,
    from_country_code: input.from?.countryCode ?? null,
    from_lat: input.from?.lat ?? null,
    from_lng: input.from?.lng ?? null,
    sent_on: input.sentOn,
    received_on: input.receivedOn || null,
    message: input.message.trim(),
    note: input.note.trim(),
  };
  const { data, error } = input.id
    ? await supabase.from("private_postcards").update(fields).eq("id", input.id).select("id").single()
    : await supabase.from("private_postcards").insert(fields).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/private", "layout");
  return { id: data.id as string };
}

/** Save photos already uploaded to your private folder; the old ones are removed. */
export async function setPrivatePhotos(id: string, frontPath: string | null, backPath: string | null): Promise<Result> {
  const { supabase } = await requireMember();
  const { data: card } = await supabase.from("private_postcards").select("front_path, back_path").eq("id", id).single();
  if (!card) return { error: "Couldn't find that postcard." };

  const { error } = await supabase
    .from("private_postcards")
    .update({ front_path: frontPath ?? card.front_path, back_path: backPath ?? card.back_path })
    .eq("id", id);
  if (error) return { error: error.message };

  const replaced = [frontPath && card.front_path, backPath && card.back_path].filter((p): p is string => !!p);
  if (replaced.length) await supabase.storage.from("private-postcards").remove(replaced);
  revalidatePath("/private", "layout");
  return {};
}

export async function deletePrivateCard(id: string): Promise<Result> {
  const { supabase } = await requireMember();
  const { data: card } = await supabase.from("private_postcards").select("front_path, back_path").eq("id", id).single();
  if (!card) return { error: "That postcard is already gone." };
  const paths = [card.front_path, card.back_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("private-postcards").remove(paths);
  const { error } = await supabase.from("private_postcards").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/private", "layout");
  return {};
}
