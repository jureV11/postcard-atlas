"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setPostcardAddress } from "@/app/(app)/address-actions";
import { AddressSelect, currentAddressId } from "@/components/AddressSelect";
import { CitySearch } from "@/components/CitySearch";
import { MemberPicker } from "@/components/MemberPicker";
import { todayLocal } from "@/lib/dates";
import type { City } from "@/lib/geo";
import type { Address, LocatedPostcard, MemberWithAvatar } from "@/lib/types";
import { HandDeliveredField } from "@/components/HandDeliveredField";
import { setHandDelivered, updatePostcard } from "../../actions";

export function SenderEditForm({
  card,
  recipients,
  recipientLocked,
  addresses,
}: {
  card: LocatedPostcard;
  recipients: MemberWithAvatar[];
  recipientLocked: boolean;
  addresses: Address[];
}) {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState(card.recipient_id);
  const recipientAddresses = addresses.filter((a) => a.member_id === recipientId);
  // Keep the card's address while the recipient is unchanged; otherwise their current one.
  const [addressId, setAddressId] = useState<string | null>(card.recipient_address_id ?? null);
  const effectiveAddressId = recipientAddresses.some((a) => a.id === addressId)
    ? addressId
    : currentAddressId(recipientAddresses);
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
  const [handDelivered, setHandDeliveredState] = useState(!!card.hand_delivered);
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
    if (handDelivered !== !!card.hand_delivered) {
      const r = await setHandDelivered(card.id, handDelivered);
      if (r.error) {
        setBusy(false);
        return setError(`Saved, but "hand delivered" didn't change: ${r.error}`);
      }
    }
    if (effectiveAddressId && effectiveAddressId !== card.recipient_address_id) {
      const r = await setPostcardAddress(card.id, effectiveAddressId);
      if (r.error) {
        setBusy(false);
        return setError(`Saved, but the address didn't change: ${r.error}`);
      }
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
        {recipientAddresses.length > 0 && (
          <div>
            <label className="label" htmlFor="sentTo">
              Sent to address
            </label>
            {recipientAddresses.length > 1 ? (
              <AddressSelect id="sentTo" addresses={recipientAddresses} value={effectiveAddressId} onChange={setAddressId} />
            ) : (
              <p className="text-sm text-ink-soft">{recipientAddresses[0].address_line}</p>
            )}
            <p className="hint">Distances and stats follow the address you pick.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="fromCity">
            Sent from
          </label>
          <CitySearch id="fromCity" value={from} onChange={setFrom} placeholder="Which city did you send it from?" />
        </div>
        <div>
          <label className="label" htmlFor="sentOn">
            {handDelivered ? "Date handed over" : "Date sent"}
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
          {card.status !== "lost" && <HandDeliveredField checked={handDelivered} onChange={setHandDeliveredState} />}
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
