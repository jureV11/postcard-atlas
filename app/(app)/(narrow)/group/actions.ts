"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Leave the group. Your postcards stay in its history under "(former member)",
 * and rejoining later with the invite code brings your profile back.
 */
export async function leaveGroup(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
