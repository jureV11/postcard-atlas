"use server";

import { requireMember } from "@/lib/session";
import { removeFiles } from "@/lib/media";

export async function saveProfile(displayName: string, color: string, avatarPath: string | null) {
  const { supabase, member } = await requireMember();
  const { error } = await supabase.from("members").update({
    display_name: displayName, color,
    ...(avatarPath ? { avatar_path: avatarPath } : {}),
  }).eq("id", member.id);
  if (error) return { error: error.message, code: error.code };
  if (avatarPath && member.avatar_path) await removeFiles(supabase, "avatars", [member.avatar_path]);
  return {};
}

export async function removePendingAvatar(path: string) {
  const { supabase } = await requireMember();
  await removeFiles(supabase, "avatars", [path]);
}
