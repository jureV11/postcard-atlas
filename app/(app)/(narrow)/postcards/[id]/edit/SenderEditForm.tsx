"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CitySearch } from "@/components/CitySearch";
import { MemberPicker } from "@/components/MemberPicker";
import { todayLocal } from "@/lib/dates";
import type { City } from "@/lib/geo";
import type { LocatedPostcard, MemberWithAvatar } from "@/lib/types";
import { updatePostcard } from "../../actions";

export function SenderEditForm({
  card,
  recipients,
  recipientLocked,
}: {
  card: LocatedPostcard;
  recipients: MemberWithAvatar[];
  recipientLocked: boolean;
}) {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState(card.recipient_id);
  const [from, setFrom] = useState<City | null>({
    name: card.from_city,
    country: card.from_country,
    countryCode: card.from_country_code,
    lat: card.from_lat,
    lng: card.from_lng,
  });
  const [sentOn, setSentOn] = useState(card.sent_on);
  const [message, setMessage] = useState(card.message ?? "");
  const [note, setNote] = useState(card.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => setToday(todayLocal()), []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from) return setError("Pick the city you sent it from.");
    if (!sentOn) return setError("When did you send it?");
    setBusy(true);
    const result = await updatePostcard({ id: card.id, recipientId, from, sentOn, message, note });
    if (result.error) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(`/postcards/${card.id}`);
    router.refresh();
  }

  const lockedTo = recipients.find((r) => r.id === card.recipient_id);

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="card space-y-5">
        <div>
          <p className="label">To</p>
          {recipientLocked ? (
            <p className="text-sm text-ink-soft">
              {lockedTo?.display_name ?? "The recipient"} — already received, so this can&apos;t change.
            </p>
          ) : (
            <MemberPicker members={recipients} value={recipientId} onChange={setRecipientId} />
          )}
        </div>
        <div>
          <label className="label" htmlFor="fromCity">
            Sent from
          </label>
          <CitySearch id="fromCity" value={from} onChange={setFrom} placeholder="Which city did you send it from?" />
        </div>
        <div>
          <label className="label" htmlFor="sentOn">
            Date sent
          </label>
          <input
            id="sentOn"
            type="date"
            className="input"
            value={sentOn}
            max={card.received_on ?? today}
            onChange={(e) => setSentOn(e.target.value)}
            required
          />
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="message">
            Message <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="message"
            className="input min-h-28"
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="note">
            Note <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input id="note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
