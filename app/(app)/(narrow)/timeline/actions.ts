"use server";

import { revalidatePath } from "next/cache";
import type { City } from "@/lib/geo";
import { requireMember } from "@/lib/session";

type Result = { error?: string };

export type MeetupInput = {
  id?: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  place: City | null;
  memberIds: string[];
  postcardId: string | null;
};

/** Add a meetup, or change one (anyone in the group may). Returns its id. */
export async function saveMeetup(input: MeetupInput): Promise<Result & { id?: string }> {
  const { supabase, member } = await requireMember();
  const title = input.title.trim();
  if (!title) return { error: "Give the meetup a name." };
  if (input.endsOn && input.endsOn < input.startsOn) return { error: "It can't end before it starts." };

  const fields = {
    title,
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    city: input.place?.name ?? null,
    country: input.place?.country ?? null,
    country_code: input.place?.countryCode ?? null,
    lat: input.place?.lat ?? null,
    lng: input.place?.lng ?? null,
    postcard_id: input.postcardId,
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("meetups").update(fields).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("meetups")
      .insert({ ...fields, group_id: member.group_id, created_by: member.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    id = data.id as string;
  }

  // Who was there: only add and remove the changes, so people already on it
  // don't get another "you were added" in their inbox
  const { data: rows } = await supabase.from("meetup_members").select("member_id").eq("meetup_id", id);
  const before = new Set((rows ?? []).map((r) => r.member_id as string));
  const removed = [...before].filter((m) => !input.memberIds.includes(m));
  const added = input.memberIds.filter((m) => !before.has(m));
  if (removed.length) {
    const { error } = await supabase.from("meetup_members").delete().eq("meetup_id", id).in("member_id", removed);
    if (error) return { error: error.message, id };
  }
  if (added.length) {
    const { error } = await supabase.from("meetup_members").insert(added.map((member_id) => ({ meetup_id: id, member_id })));
    if (error) return { error: error.message, id };
  }

  revalidatePath("/timeline", "layout");
  return { id };
}

/** Only whoever added a meetup can delete it (the database checks). Its photos go too. */
export async function deleteMeetup(id: string): Promise<Result> {
  const { supabase, member } = await requireMember();
  const { data: meetup } = await supabase.from("meetups").select("created_by").eq("id", id).single();
  if (!meetup || meetup.created_by !== member.id) return { error: "Only the person who added this meetup can delete it." };

  const { data: photos } = await supabase.from("meetup_photos").select("path").eq("meetup_id", id);
  const paths = (photos ?? []).map((p) => p.path as string);
  if (paths.length) await supabase.storage.from("meetups").remove(paths);

  const { error } = await supabase.from("meetups").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/timeline", "layout");
  return {};
}

/** Save photos already uploaded to storage. The first becomes the main one if there isn't one yet. */
export async function addMeetupPhotos(meetupId: string, paths: string[]): Promise<Result> {
  const { supabase, member } = await requireMember();
  const { data: main } = await supabase.from("meetup_photos").select("id").eq("meetup_id", meetupId).eq("is_main", true);
  const hasMain = !!main?.length;
  const { error } = await supabase
    .from("meetup_photos")
    .insert(paths.map((path, i) => ({ meetup_id: meetupId, path, uploaded_by: member.id, is_main: !hasMain && i === 0 })));
  if (error) {
    await supabase.storage.from("meetups").remove(paths); // don't leave orphaned files
    return { error: error.message.includes("up to 10") ? "A meetup can have up to 10 photos." : error.message };
  }
  revalidatePath("/timeline", "layout");
  return {};
}

export async function setMainPhoto(meetupId: string, photoId: string): Promise<Result> {
  const { supabase } = await requireMember();
  // One main photo per meetup: clear the old one first
  const { error: clearError } = await supabase.from("meetup_photos").update({ is_main: false }).eq("meetup_id", meetupId).eq("is_main", true);
  if (clearError) return { error: clearError.message };
  const { error } = await supabase.from("meetup_photos").update({ is_main: true }).eq("id", photoId).eq("meetup_id", meetupId);
  if (error) return { error: error.message };
  revalidatePath("/timeline", "layout");
  return {};
}

/** Whoever added the photo, or anyone who was there, may remove it. */
export async function removeMeetupPhoto(photoId: string): Promise<Result> {
  const { supabase } = await requireMember();
  const { data: photo } = await supabase.from("meetup_photos").select("path, is_main, meetup_id").eq("id", photoId).single();
  if (!photo) return { error: "That photo is already gone." };

  // The file first: the database checks the photo's row to allow it
  const { data: removed, error: storageError } = await supabase.storage.from("meetups").remove([photo.path as string]);
  if (storageError) return { error: storageError.message };
  if (!removed?.length) return { error: "Only whoever added this photo, or someone who was there, can remove it." };

  const { error } = await supabase.from("meetup_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  // Keep a main photo if there are any left
  if (photo.is_main) {
    const { data: next } = await supabase
      .from("meetup_photos")
      .select("id")
      .eq("meetup_id", photo.meetup_id)
      .order("created_at")
      .limit(1);
    if (next?.length) await supabase.from("meetup_photos").update({ is_main: true }).eq("id", next[0].id);
  }
  revalidatePath("/timeline", "layout");
  return {};
}

/** Your own write-up of a meetup: one each, signed with your name. Empty deletes it. */
export async function saveMeetupNote(meetupId: string, body: string): Promise<Result> {
  const { supabase, member } = await requireMember();
  const text = body.trim();
  if (text.length > 4000) return { error: "That's a bit long: keep it under 4,000 characters." };
  const { error } = text
    ? await supabase
        .from("meetup_notes")
        .upsert(
          { meetup_id: meetupId, member_id: member.id, body: text, updated_at: new Date().toISOString() },
          { onConflict: "meetup_id,member_id" },
        )
    : await supabase.from("meetup_notes").delete().eq("meetup_id", meetupId).eq("member_id", member.id);
  if (error) return { error: error.message };
  revalidatePath("/timeline", "layout");
  return {};
}
