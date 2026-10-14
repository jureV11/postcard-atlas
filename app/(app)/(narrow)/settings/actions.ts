"use server";

import { createClient } from "@/lib/supabase/server";

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
