import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";

/** Signed-in user plus their membership (null until they create/join a group). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
  return { supabase, user, member: data as Member | null };
});

/** For pages inside the app: sends people without a group to onboarding. */
export async function requireMember() {
  const session = await getSession();
  if (!session.member) redirect("/onboarding");
  return { ...session, member: session.member };
}
