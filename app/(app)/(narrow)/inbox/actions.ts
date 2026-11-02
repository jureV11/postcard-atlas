"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";

/** "Mark all as read": clears the badge in one go. */
export async function markInboxRead(): Promise<void> {
  const { supabase, member } = await requireMember();
  await supabase
    .from("inbox_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", member.id)
    .is("read_at", null)
    .is("deleted_at", null);
  revalidatePath("/", "layout");
}

/** The envelope on each message: open it (read) or seal it again (unread), without going anywhere. */
export async function setMessageRead(id: string, read: boolean): Promise<void> {
  const { supabase, member } = await requireMember();
  await supabase
    .from("inbox_messages")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("member_id", member.id);
  revalidatePath("/", "layout");
}

/** The bin on each message: hides it, with an "Undo" bar on the inbox. */
export async function deleteMessage(id: string): Promise<void> {
  const { supabase, member } = await requireMember();
  await supabase.from("inbox_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("member_id", member.id);
  revalidatePath("/", "layout");
  redirect(`/inbox?deleted=${id}`);
}

/** "Undo": brings a binned message back. */
export async function restoreMessage(id: string): Promise<void> {
  const { supabase, member } = await requireMember();
  await supabase.from("inbox_messages").update({ deleted_at: null }).eq("id", id).eq("member_id", member.id);
  revalidatePath("/", "layout");
  redirect("/inbox");
}
