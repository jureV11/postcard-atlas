"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

type Result = { error?: string; notice?: string };

// Server-side so the session cookie is set on the response directly.
export async function signInWithPassword(email: string, password: string, next: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.code === "invalid_credentials") {
      return {
        error:
          "Wrong email or password. If you joined using an email link and never set a password, use “Email me a link” once, then set a password on your profile page.",
      };
    }
    return { error: error.message };
  }
  redirect(safeNext(next));
}

export async function signUpWithPassword(email: string, password: string, next: string): Promise<Result> {
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) {
    if (error.code === "user_already_exists") return { error: "You already have an account — sign in instead." };
    return { error: error.message };
  }
  // If "Confirm email" is on in Supabase, there's no session until they click the email.
  if (!data.session) return { notice: "Almost there — check your email to confirm your account, then sign in." };
  redirect(safeNext(next));
}
