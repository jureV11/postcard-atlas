"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Leave the group (only possible with no postcards there). Your old profile photo
 * stays in storage, readable only by that group's members — harmless, and safer
 * than deleting it before we know leaving will succeed.
 */
export async function leaveGroup(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function setPassword(password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return {};
    return { error: error.message };
  }
  return {};
}
