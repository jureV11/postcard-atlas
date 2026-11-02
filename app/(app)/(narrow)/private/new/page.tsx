import Link from "next/link";
import { requireMember } from "@/lib/session";
import { PrivateCardForm } from "../PrivateCardForm";

export default async function NewPrivateCardPage({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  const { direction } = await searchParams;
  const { user } = await requireMember();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/private" className="text-sm text-ink-soft hover:text-ink">
          ← Private postcards
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Add a private postcard</h1>
        <p className="mt-1 text-ink-soft">Just for you: it won&apos;t show on the map, in stats or to the group.</p>
      </div>
      <PrivateCardForm
        userId={user.id}
        initial={{ direction: direction === "received" ? "received" : "sent", person: "", from: null, sentOn: "", receivedOn: "", message: "", note: "", frontUrl: null, backUrl: null }}
      />
    </div>
  );
}
