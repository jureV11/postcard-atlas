"use server";

import { createClient } from "@/lib/supabase/server";
import type { City } from "@/lib/geo";

type Input = {
  mode: "create" | "join";
  groupName: string;
  code: string;
  displayName: string;
  color: string;
  home: City;
};

export type GroupPreview = { group_name: string; member_names: string[]; taken_colors: string[] };

export async function previewGroup(code: string): Promise<GroupPreview | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("group_preview", { p_code: code }).maybeSingle();
  return (data as GroupPreview | null) ?? null;
}

// Runs server-side with the session cookie, so it works even if the browser
// client's copy of the session is stale (e.g. after signing in from another tab).
export async function createOrJoinGroup(input: Input): Promise<{ groupId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your sign-in has expired — please sign in again." };

  const profileArgs = {
    p_display_name: input.displayName,
    p_color: input.color,
    p_home_city: input.home.name,
    p_home_country: input.home.country,
    p_home_country_code: input.home.countryCode,
    p_home_lat: input.home.lat,
    p_home_lng: input.home.lng,
  };

  const { data, error } =
    input.mode === "create"
      ? await supabase.rpc("create_group", { p_group_name: input.groupName, ...profileArgs })
      : await supabase.rpc("join_group", { p_code: input.code, ...profileArgs });

  if (error) return { error: error.message };
  return { groupId: data as string };
}
