import type { PostgrestClient } from "@supabase/postgrest-js";
import type { Member, MemberWithAvatar } from "@/lib/types";

export type Bucket = "avatars" | "postcards" | "meetups" | "private-postcards";

export async function signPaths(
  _client: PostgrestClient,
  bucket: Bucket,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  return new Map(paths.filter((p): p is string => !!p).map((p) =>
    [p, `/api/media/${bucket}/${p.split("/").map(encodeURIComponent).join("/")}`]));
}

export async function signAvatarUrls(client: PostgrestClient, members: Member[]): Promise<MemberWithAvatar[]> {
  const urls = await signPaths(client, "avatars", members.map((m) => m.avatar_path));
  return members.map((m) => ({ ...m, avatar_url: m.avatar_path ? urls.get(m.avatar_path) ?? null : null }));
}
