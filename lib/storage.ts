import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, MemberWithAvatar } from "@/lib/types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Buckets are private, so images are served through short-lived signed URLs. */
export async function signPaths(
  supabase: SupabaseClient,
  bucket: "avatars" | "postcards",
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!unique.length) return urls;

  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL);
  data?.forEach((d) => {
    if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  });
  return urls;
}

export async function signAvatarUrls(
  supabase: SupabaseClient,
  members: Member[],
): Promise<MemberWithAvatar[]> {
  const urls = await signPaths(supabase, "avatars", members.map((m) => m.avatar_path));
  return members.map((m) => ({
    ...m,
    avatar_url: m.avatar_path ? (urls.get(m.avatar_path) ?? null) : null,
  }));
}
