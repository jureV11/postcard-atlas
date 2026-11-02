import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UNLOCKED = "Achievement unlocked: ";

/** Clicking an inbox message: mark it read, then go where it points (or back to the inbox). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // The database only lets you read and update your own messages
  const { data: message } = await supabase
    .from("inbox_messages")
    .select("kind, title, link, member_id")
    .eq("id", id)
    .maybeSingle();
  if (message) {
    await supabase.from("inbox_messages").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    revalidatePath("/", "layout"); // the badge on the avatar
  }

  let to = "/inbox";
  if (message?.kind === "achievement" && String(message.title).startsWith(UNLOCKED)) {
    // Straight to that achievement on your profile, unfolded (by name, so older messages work too)
    const name = String(message.title).slice(UNLOCKED.length);
    to = `/members/${message.member_id}?achievement=${encodeURIComponent(name)}#unlocked`;
  } else if (message?.link) {
    // Only ever an in-app path, never somewhere else
    const link = String(message.link);
    if (link.startsWith("/") && !link.startsWith("//")) to = link;
  }
  return NextResponse.redirect(new URL(to, request.url));
}
