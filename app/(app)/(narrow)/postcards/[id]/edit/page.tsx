import Link from "next/link";
import { notFound } from "next/navigation";
import { visibleTo } from "@/lib/postcards";
import { requireMember } from "@/lib/session";
import { signAvatarUrls } from "@/lib/storage";
import { isLocated, type Member, type Postcard } from "@/lib/types";
import { DeleteButton } from "../DeleteButton";
import { RecipientEditForm } from "./RecipientEditForm";
import { SenderEditForm } from "./SenderEditForm";

export default async function EditPostcardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, member } = await requireMember();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("postcard_feed").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const card = data as Postcard;
  if (!visibleTo(card, member.id)) notFound();

  const isSender = card.sender_id === member.id;
  const isRecipient = card.recipient_id === member.id;
  const received = card.status === "received";
  // Senders can always edit; recipients only once it's arrived (before that it's a mystery).
  if (!isSender && !(isRecipient && received)) notFound();

  const back = (
    <Link href={`/postcards/${card.id}`} className="text-sm text-ink-soft hover:text-ink">
      ← Back to the postcard
    </Link>
  );

  if (isSender) {
    if (!isLocated(card)) notFound();
    const { data: rows } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", member.group_id)
      .neq("id", member.id)
      .order("display_name");
    const recipients = await signAvatarUrls(supabase, (rows ?? []) as Member[]);

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          {back}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Edit postcard</h1>
          <p className="mt-1 text-ink-soft">
            {received
              ? "It's already arrived, so who it went to is set — but you can fix where and when it was sent."
              : "Still in transit, so you can change anything — even who it's for."}
          </p>
        </div>
        <SenderEditForm card={card} recipients={recipients} recipientLocked={received} />
        {!received && (
          <section className="card flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Logged it by mistake?</p>
              <p className="text-sm text-ink-soft">Delete it completely. Only possible before it arrives.</p>
            </div>
            <DeleteButton cardId={card.id} groupId={card.group_id} />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        {back}
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Edit postcard</h1>
        <p className="mt-1 text-ink-soft">Fix the date it arrived or the message. Photos can be changed on the postcard page.</p>
      </div>
      <RecipientEditForm
        cardId={card.id}
        groupId={card.group_id}
        sentOn={card.sent_on}
        receivedOn={card.received_on ?? card.sent_on}
        message={card.message ?? ""}
      />
    </div>
  );
}
