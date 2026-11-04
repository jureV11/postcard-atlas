import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

// Handles both magic-link styles: PKCE (?code=) and token hash (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(next);
  }

  return redirectTo("/login?error=link");
}
