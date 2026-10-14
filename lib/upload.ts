import type { BrowserSupabase } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";

/** Resize to a 512px square and upload; returns the storage path. */
export async function uploadAvatar(
  supabase: BrowserSupabase,
  groupId: string,
  userId: string,
  file: File,
): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 512, square: true });
  const path = `${groupId}/${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

/** Resize to max 1600px and upload one side of a postcard; returns the storage path. */
export async function uploadPostcardPhoto(
  supabase: BrowserSupabase,
  groupId: string,
  postcardId: string,
  side: "front" | "back",
  file: File,
): Promise<string> {
  const blob = await resizeImage(file, { maxDim: 1600, quality: 0.82 });
  const path = `${groupId}/${postcardId}/${side}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("postcards")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}
