import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/session";
import { signPaths } from "@/lib/storage";
import type { PrivatePostcard } from "@/lib/types";
import { PrivateCardForm } from "../PrivateCardForm";

export default async function PrivateCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireMember();
  const { data } = await supabase.from("private_postcards").select("*").eq("id", id).maybeSingle();
  if (!data) notFound(); // someone else's (the database hides those) or gone
  const c = data as PrivatePostcard;
  const urls = await signPaths(supabase, "private-postcards", [c.front_path, c.back_path]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/private" className="text-sm text-ink-soft hover:text-ink">
          ← Private postcards
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {c.person ? `${c.direction === "sent" ? "To" : "From"} ${c.person}` : "Private postcard"}
        </h1>
        <p className="mt-1 text-ink-soft">Only you can see this.</p>
      </div>
      <PrivateCardForm
        userId={user.id}
        initial={{
          id: c.id,
          direction: c.direction,
          person: c.person,
          from:
            c.from_city && c.from_country && c.from_country_code && c.from_lat !== null && c.from_lng !== null
              ? { name: c.from_city, country: c.from_country, countryCode: c.from_country_code, lat: c.from_lat, lng: c.from_lng }
              : null,
          sentOn: c.sent_on,
          receivedOn: c.received_on ?? "",
          message: c.message ?? "",
          note: c.note,
          frontUrl: c.front_path ? (urls.get(c.front_path) ?? null) : null,
          backUrl: c.back_path ? (urls.get(c.back_path) ?? null) : null,
        }}
      />
    </div>
  );
}
